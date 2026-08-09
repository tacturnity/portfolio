import os
import json
import warnings
import concurrent.futures
import gc
from PIL import Image, ExifTags, ImageStat, ImageCms
from pathlib import Path

# --- CONFIG ---
Image.MAX_IMAGE_PIXELS = None 
warnings.simplefilter('ignore', Image.DecompressionBombWarning)

BASE_PATH = "../photos"
OPTIMIZED_BASE = "public/optimized2" 
CATEGORIES = ["animals", "misc", "people", "panos"]
QUALITY_LARGE = 90   
QUALITY_MEDIUM = 80   
QUALITY_THUMB = 75
WEBP_LIMIT = 16383  # Hard WebP specification limit

# Cache location config as specified
CACHE_DIR = r"P:\drive_v2\OCCOS\Portfolio Occo_v2"
CACHE_FILE_PATH = os.path.join(CACHE_DIR, "processed_cache.json")
# --------------

if not os.path.exists(CACHE_DIR):
    CACHE_FILE_PATH = "processed_cache.json"

def get_metadata(filepath):
    date, iso, aperture, shutter = "Unknown", "N/A", "N/A", "N/A"
    try:
        with Image.open(filepath) as img:
            exif = img.getexif()
            if not exif:
                return date, iso, aperture, shutter
            all_tags = {k: v for k, v in exif.items()}
            exif_ifd = exif.get_ifd(34665)
            all_tags.update(exif_ifd)
            def get_val(tag_id): return all_tags.get(tag_id)
            date_raw = get_val(36867) or get_val(306)
            if date_raw: date = str(date_raw).split(' ')[0].replace(':', '-')
            iso_val = get_val(34855)
            if iso_val: iso = str(iso_val)
            f_val = get_val(33437)
            if f_val:
                try:
                    val = float(f_val)
                    aperture = f"f/{int(val)}" if val.is_integer() else f"f/{val:.1f}"
                except: aperture = str(f_val)
            shut_val = get_val(33434)
            if shut_val:
                try:
                    val = float(shut_val)
                    if val < 1: shutter = f"1/{int(round(1/val))}"
                    else: shutter = f"{int(val) if val.is_integer() else val}s"
                except: shutter = str(shut_val)
    except: pass
    return date, iso, aperture, shutter

def save_webp_safe(image_obj, target_path, quality, method=4, icc_profile=None):
    """
    Saves WebP preserving ICC color profile with a progressive fallback chain:
    1. Standard high-quality export (quality=90, method=4)
    2. Lower encoding method (method=0) to relieve RAM
    3. Lower quality (quality=82) to resolve Partition 0 Overflow
    4. Strip ICC profile if corrupted/oversized
    """
    save_kwargs = {"quality": quality, "method": method}
    if icc_profile:
        save_kwargs["icc_profile"] = icc_profile
        
    # Attempt 1: Standard high quality
    try:
        image_obj.save(target_path, "WEBP", **save_kwargs)
        return
    except Exception:
        pass

    # Attempt 2: Fast method=0 (Relieves RAM pressure / Error 1)
    try:
        save_kwargs["method"] = 0
        image_obj.save(target_path, "WEBP", **save_kwargs)
        return
    except Exception:
        pass

    # Attempt 3: Lower quality slightly to 82 (Fixes Partition 0 Overflow / Error 6)
    try:
        save_kwargs["method"] = 4
        save_kwargs["quality"] = min(quality, 82)
        image_obj.save(target_path, "WEBP", **save_kwargs)
        return
    except Exception:
        pass

    # Attempt 4: Drop ICC profile if profile chunk was oversized/corrupted
    try:
        save_kwargs.pop("icc_profile", None)
        save_kwargs["quality"] = min(quality, 82)
        image_obj.save(target_path, "WEBP", **save_kwargs)
        return
    except Exception as final_err:
        raise final_err

def is_heavy_image(task):
    """Inspects file metadata without decoding pixels to categorize standard vs heavy/panorama tasks."""
    full_input_path, category, rel_path, file, cache_key, mtime, size = task
    
    # Force panoramas into safe queue
    if category.lower() == "panos" or "-pano" in file.lower() or "_pano" in file.lower():
        return True
    
    # Files > 20 MB on disk
    if size > 20 * 1024 * 1024:
        return True
        
    try:
        with Image.open(full_input_path) as img:
            w, h = img.size
            # Total pixels > 20 Megapixels or dimension > 5500px
            if (w * h) > 20_000_000 or w > 5500 or h > 5500:
                return True
    except:
        pass
        
    return False

def process_file(task_data):
    full_input_path, category, rel_path, filename, cache_key, mtime, size = task_data
    
    if filename.lower().endswith('.webp'): clean_name = filename
    else: clean_name = os.path.splitext(filename)[0] + ".webp"
    
    large_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "large")
    medium_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "medium")
    thumb_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "thumb")
    
    os.makedirs(large_dir, exist_ok=True)
    os.makedirs(medium_dir, exist_ok=True)
    os.makedirs(thumb_dir, exist_ok=True)

    try:
        with Image.open(full_input_path) as img:
            # Extract ICC Profile metadata (Display P3 / Adobe RGB / sRGB) for color fidelity
            icc_profile = img.info.get("icc_profile")

            # 1. Handle Orientation
            try:
                exif = img.getexif()
                if exif:
                    orientation = exif.get(274)
                    if orientation == 3: img = img.rotate(180, expand=True)
                    elif orientation == 6: img = img.rotate(270, expand=True)
                    elif orientation == 8: img = img.rotate(90, expand=True)
            except: pass

            # Ensure compatible color space format (RGB / RGBA) for WebP
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img = img.convert('RGBA')
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Calculate Brightness (0.0 to 1.0)
            try:
                grayscale = img.convert('L')
                stat = ImageStat.Stat(grayscale)
                brightness = stat.mean[0] / 255.0
            except: 
                brightness = 0.5

            # 2. Safety Resize ONLY if exceeding WebP hard limit (16,383px)
            curr_w, curr_h = img.size
            if curr_w > WEBP_LIMIT or curr_h > WEBP_LIMIT:
                if curr_w > curr_h:
                    new_w = WEBP_LIMIT
                    new_h = int(curr_h * (WEBP_LIMIT / curr_w))
                else:
                    new_h = WEBP_LIMIT
                    new_w = int(curr_w * (WEBP_LIMIT / curr_h))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            final_w, final_h = img.size

            # 3. Save Large (Full resolution preserved + ICC Color Profile)
            large_path = os.path.join(large_dir, clean_name)
            save_webp_safe(img, large_path, QUALITY_LARGE, method=4, icc_profile=icc_profile)

            # 4. Save Medium (800px for Grid)
            medium_path = os.path.join(medium_dir, clean_name)
            m_img = img.copy()
            m_img.thumbnail((800, 800), Image.Resampling.LANCZOS)
            save_webp_safe(m_img, medium_path, QUALITY_MEDIUM, method=4, icc_profile=icc_profile)

            # 5. Save Thumb (200px for 3D Wall)
            thumb_path = os.path.join(thumb_dir, clean_name)
            t_img = img.copy()
            t_img.thumbnail((200, 200), Image.Resampling.LANCZOS)
            save_webp_safe(t_img, thumb_path, QUALITY_THUMB, method=4, icc_profile=icc_profile)

            # 6. Metadata
            date, iso, ap, shut = get_metadata(full_input_path)
            
            url_rel = rel_path.replace(os.sep, '/')
            if url_rel: url_rel += '/'

            metadata = {
                "url_large": f"/portfolio/optimized2/{category}/{url_rel}large/{clean_name}",
                "url_medium": f"/portfolio/optimized2/{category}/{url_rel}medium/{clean_name}",
                "url_thumb": f"/portfolio/optimized2/{category}/{url_rel}thumb/{clean_name}",
                "brightness": brightness,
                "category": category.capitalize(),
                "title": filename.split('.')[0].replace('_', ' ').replace('-', ' ').title(),
                "date": date, "iso": iso, "aperture": ap, "shutter": shut,
                "width": final_w, "height": final_h
            }

            # Force garbage collection to free RAM immediately
            gc.collect()

            return {
                "cache_key": cache_key,
                "mtime": mtime,
                "size": size,
                "metadata": metadata
            }
    except Exception as e:
        print(f"❌ Failed to process {filename}: {e}")
        gc.collect()
        return None

def load_cache():
    if os.path.exists(CACHE_FILE_PATH):
        try:
            with open(CACHE_FILE_PATH, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Failed to read cache file: {e}. Starting fresh.")
    return {}

def save_cache(cache_data):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
        with open(CACHE_FILE_PATH, 'w') as f:
            json.dump(cache_data, f, indent=4)
        print(f"💾 Cache file updated: {CACHE_FILE_PATH}")
    except Exception as e:
        print(f"⚠️ Failed to write cache file: {e}")

def main():
    print("🚀 Loading image processing cache map...")
    cache = load_cache()

    print("🚀 Gathering files for Multi-threaded Layout Verification...")
    
    tasks = []
    photo_list = []
    new_cache = {}

    for cat in CATEGORIES:
        cat_path = os.path.join(BASE_PATH, cat)
        if not os.path.exists(cat_path): continue
        for root, dirs, files in os.walk(cat_path):
            rel_path = os.path.relpath(root, cat_path)
            if rel_path == ".": rel_path = ""
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    full_input_path = os.path.join(root, file)
                    
                    try:
                        stat_info = os.stat(full_input_path)
                        mtime = stat_info.st_mtime
                        size = stat_info.st_size
                    except Exception as e:
                        print(f"⚠️ Failed to read file stats for {file}: {e}")
                        tasks.append((full_input_path, cat, rel_path, file, file, 0, 0))
                        continue

                    cache_key = os.path.join(cat, rel_path, file).replace(os.sep, '/')
                    
                    is_cached = False
                    if cache_key in cache:
                        entry = cache[cache_key]
                        if entry.get("mtime") == mtime and entry.get("size") == size:
                            metadata = entry.get("metadata")
                            if metadata:
                                outputs_exist = True
                                for url_key in ["url_large", "url_medium", "url_thumb"]:
                                    url_val = metadata.get(url_key, "")
                                    local_dest_path = url_val.replace("/portfolio/optimized2/", "public/optimized2/")
                                    if not os.path.exists(local_dest_path):
                                        outputs_exist = False
                                        break
                                
                                if outputs_exist:
                                    photo_list.append(metadata)
                                    new_cache[cache_key] = entry
                                    is_cached = True

                    if not is_cached:
                        tasks.append((full_input_path, cat, rel_path, file, cache_key, mtime, size))

    if tasks:
        standard_tasks = []
        heavy_tasks = []

        for task in tasks:
            if is_heavy_image(task):
                heavy_tasks.append(task)
            else:
                standard_tasks.append(task)

        def process_result(res):
            if res:
                cache_key = res["cache_key"]
                photo_list.append(res["metadata"])
                new_cache[cache_key] = {
                    "mtime": res["mtime"],
                    "size": res["size"],
                    "metadata": res["metadata"]
                }

        # --- PHASE 1: Standard Images (6 Parallel Workers to prevent heap thrashing) ---
        if standard_tasks:
            max_cores = min(os.cpu_count() or 1, 6)
            print(f"\n⚡ PHASE 1: Running {max_cores} parallel workers for {len(standard_tasks)} standard photos...")
            
            with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
                futures = {executor.submit(process_file, task): task for task in standard_tasks}
                for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                    res = future.result()
                    if res:
                        process_result(res)
                        print(f"  ✅ [Standard {i}/{len(standard_tasks)}] Processed: {res['metadata']['title']}")

        # --- PHASE 2: Panoramas / High-Res DSLR Images (2 Safe Workers) ---
        if heavy_tasks:
            print(f"\n🏔️ PHASE 2: Processing {len(heavy_tasks)} high-resolution panoramas/DSLR photos safely with 2 dedicated workers...")
            
            with concurrent.futures.ProcessPoolExecutor(max_workers=2) as executor:
                futures = {executor.submit(process_file, task): task for task in heavy_tasks}
                for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                    res = future.result()
                    if res:
                        process_result(res)
                        print(f"  ✅ [Panorama/Heavy {i}/{len(heavy_tasks)}] Processed: {res['metadata']['title']}")

    else:
        print("🎉 All images are already optimized. Skipping WebP exports.")

    print("\n🔄 Sorting and saving...")
    photo_list.sort(key=lambda x: x['date'], reverse=True)
    for index, photo in enumerate(photo_list): photo['id'] = index + 1

    # --- AUTOMATIC LATEST PHOTO PREVIEW ---
    if photo_list:
        import shutil
        latest_photo = photo_list[0]
        url_large = latest_photo.get("url_large", "")
        local_large_path = url_large.replace("/portfolio/optimized2/", "public/optimized2/")
        if os.path.exists(local_large_path):
            shutil.copy2(local_large_path, "public/og-image.webp")
            print(f"🖼️ Set latest photo as OpenGraph preview (og-image.webp): {latest_photo['title']}")
    # --------------------------------------

    with open("src/photos.json", "w") as f:
        json.dump(photo_list, f, indent=4)

    save_cache(new_cache)

    print(f"\n✨ Done! Processed {len(photo_list)} active photos.")

if __name__ == "__main__":
    main()