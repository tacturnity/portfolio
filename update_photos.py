import os
import json
import warnings
import concurrent.futures
from PIL import Image, ExifTags
from pathlib import Path

# --- CONFIG ---
Image.MAX_IMAGE_PIXELS = None 
warnings.simplefilter('ignore', Image.DecompressionBombWarning)

BASE_PATH = "../photos"
OPTIMIZED_BASE = "public/optimized2" 
CATEGORIES = ["animals", "misc", "people", "panos"]
QUALITY_LARGE = 90   
QUALITY_MEDIUM = 80   
WEBP_LIMIT = 16383 # Hard limit for WebP format
# --------------

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

def process_file(task_data):
    full_input_path, category, rel_path, filename = task_data
    
    if filename.lower().endswith('.webp'): clean_name = filename
    else: clean_name = os.path.splitext(filename)[0] + ".webp"
    
    large_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "large")
    medium_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "medium")
    os.makedirs(large_dir, exist_ok=True)
    os.makedirs(medium_dir, exist_ok=True)

    try:
        with Image.open(full_input_path) as img:
            # 1. Handle Orientation
            try:
                exif = img.getexif()
                if exif:
                    orientation = exif.get(274)
                    if orientation == 3: img = img.rotate(180, expand=True)
                    elif orientation == 6: img = img.rotate(270, expand=True)
                    elif orientation == 8: img = img.rotate(90, expand=True)
            except: pass

            # 2. Safety Resize for WebP Limit (16,383px)
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

            # 3. Save Large (Max High-Res)
            large_path = os.path.join(large_dir, clean_name)
            img.save(large_path, "WEBP", quality=QUALITY_LARGE, method=4)

            # 4. Save Medium (800px for Grid)
            medium_path = os.path.join(medium_dir, clean_name)
            m_img = img.copy()
            m_img.thumbnail((800, 800))
            m_img.save(medium_path, "WEBP", quality=QUALITY_MEDIUM, method=4)

            # 5. Metadata
            date, iso, ap, shut = get_metadata(full_input_path)
            
            url_rel = rel_path.replace(os.sep, '/')
            if url_rel: url_rel += '/'

            return {
                "url_large": f"/portfolio/optimized2/{category}/{url_rel}large/{clean_name}",
                "url_medium": f"/portfolio/optimized2/{category}/{url_rel}medium/{clean_name}",
                "category": category.capitalize(),
                "title": filename.split('.')[0].replace('_', ' ').replace('-', ' ').title(),
                "date": date, "iso": iso, "aperture": ap, "shutter": shut,
                "width": final_w, "height": final_h
            }
    except Exception as e:
        print(f"❌ Failed to process {filename}: {e}")
        return None

def main():
    print("🚀 Gathering files for Multi-Core WebP Optimization...")
    tasks = []
    for cat in CATEGORIES:
        cat_path = os.path.join(BASE_PATH, cat)
        if not os.path.exists(cat_path): continue
        for root, dirs, files in os.walk(cat_path):
            rel_path = os.path.relpath(root, cat_path)
            if rel_path == ".": rel_path = ""
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    tasks.append((os.path.join(root, file), cat, rel_path, file))

    max_cores = os.cpu_count()
    print(f"🔥 Found {len(tasks)} images. Unleashing {max_cores} cores.")
    
    photo_list = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
        futures = {executor.submit(process_file, task): task for task in tasks}
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            res = future.result()
            if res:
                photo_list.append(res)
                print(f"✅ [{i}/{len(tasks)}] Processed: {res['title']}")

    print("\n🔄 Sorting and saving...")
    photo_list.sort(key=lambda x: x['date'], reverse=True)
    for index, photo in enumerate(photo_list): photo['id'] = index + 1

    with open("src/photos.json", "w") as f:
        json.dump(photo_list, f, indent=4)

    print(f"\n✨ Done! Processed {len(photo_list)} photos.")

if __name__ == "__main__":
    main()