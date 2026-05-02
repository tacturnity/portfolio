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
CATEGORIES =["animals", "misc", "people", "panos"]
QUALITY_LARGE = 85   # High quality for full-res Lightbox
QUALITY_MEDIUM = 80   # Good compression for 800px Grid
# --------------

def get_metadata(filepath):
    """Extracts EXIF data, specifically looking into the SubIFD for exposure settings."""
    date, iso, aperture, shutter = "Unknown", "N/A", "N/A", "N/A"
    
    try:
        with Image.open(filepath) as img:
            exif = img.getexif()
            if not exif:
                return date, iso, aperture, shutter
            
            all_tags = {k: v for k, v in exif.items()}
            exif_ifd = exif.get_ifd(34665)
            all_tags.update(exif_ifd)

            def get_val(tag_id):
                return all_tags.get(tag_id)

            date_raw = get_val(36867) or get_val(306)
            if date_raw:
                date = str(date_raw).split(' ')[0].replace(':', '-')

            iso_val = get_val(34855)
            if iso_val: iso = str(iso_val)

            f_val = get_val(33437)
            if f_val:
                try:
                    val = float(f_val)
                    aperture = f"f/{int(val)}" if val.is_integer() else f"f/{val:.1f}"
                except:
                    aperture = str(f_val)

            shut_val = get_val(33434)
            if shut_val:
                try:
                    val = float(shut_val)
                    if val < 1:
                        shutter = f"1/{int(round(1/val))}"
                    else:
                        shutter = f"{int(val) if val.is_integer() else val}s"
                except:
                    shutter = str(shut_val)

    except Exception as e:
        pass
        
    return date, iso, aperture, shutter

def process_file(full_input_path, category, rel_path, filename):
    """Saves a Full-Res Large WebP and an 800px Medium WebP."""
    if filename.lower().endswith('.webp'):
        clean_name = filename
    else:
        clean_name = os.path.splitext(filename)[0] + ".webp"
    
    large_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "large")
    medium_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "medium")
    os.makedirs(large_dir, exist_ok=True)
    os.makedirs(medium_dir, exist_ok=True)

    with Image.open(full_input_path) as img:
        width, height = img.size
        
        # Auto-rotate
        try:
            exif = img.getexif()
            if exif:
                orientation = exif.get(274)
                if orientation == 3: img = img.rotate(180, expand=True)
                elif orientation == 6: img = img.rotate(270, expand=True)
                elif orientation == 8: img = img.rotate(90, expand=True)
                width, height = img.size
        except: pass

        # 1. Save Large (Full Resolution WebP)
        # Using method=4 (default) instead of 6 saves MASSIVE CPU cycles at Quality 100
        large_path = os.path.join(large_dir, clean_name)
        l_img = img.copy()
        l_img.save(large_path, "WEBP", quality=QUALITY_LARGE, method=4)

        # 2. Save Medium (800px WebP for Grid)
        medium_path = os.path.join(medium_dir, clean_name)
        m_img = img.copy()
        m_img.thumbnail((800, 800))
        m_img.save(medium_path, "WEBP", quality=QUALITY_MEDIUM, method=4)

    return width, height, clean_name

def worker_task(task_data):
    """The function that each CPU core will run independently."""
    full_input_path, category, rel_path, filename = task_data
    
    w, h, webp_name = process_file(full_input_path, category, rel_path, filename)
    date, iso, ap, shut = get_metadata(full_input_path)
    
    url_rel = rel_path.replace(os.sep, '/')
    if url_rel: url_rel += '/'

    return {
        "url_large": f"/portfolio/optimized2/{category}/{url_rel}large/{webp_name}",
        "url_medium": f"/portfolio/optimized2/{category}/{url_rel}medium/{webp_name}",
        "category": category.capitalize(),
        "title": filename.split('.')[0].replace('_', ' ').replace('-', ' ').title(),
        "date": date, "iso": iso, "aperture": ap, "shutter": shut,
        "width": w, "height": h
    }

def main():
    print("🚀 Gathering files for Multi-Core WebP Optimization...")
    tasks =[]
    
    for cat in CATEGORIES:
        cat_path = os.path.join(BASE_PATH, cat)
        if not os.path.exists(cat_path):
            continue

        for root, dirs, files in os.walk(cat_path):
            rel_path = os.path.relpath(root, cat_path)
            if rel_path == ".": rel_path = ""

            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    full_input_path = os.path.join(root, file)
                    tasks.append((full_input_path, cat, rel_path, file))

    max_cores = os.cpu_count()
    print(f"🔥 Found {len(tasks)} images. Firing up all {max_cores} CPU threads!")
    
    photo_list =[]
    
    # Unleash multiprocessing
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
        # Submit all tasks to the pool
        futures = {executor.submit(worker_task, task): task for task in tasks}
        
        # As each image finishes across different cores, grab the result
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                result = future.result()
                photo_list.append(result)
                print(f"✅ [{i}/{len(tasks)}] Processed: {result['title']}")
            except Exception as e:
                task = futures[future]
                print(f"❌ Error processing {task[3]}: {e}")

    print("\n🔄 Sorting photos by date (newest first)...")
    photo_list.sort(key=lambda x: x['date'], reverse=True)

    for index, photo in enumerate(photo_list):
        photo['id'] = index + 1

    output_json = "src/photos.json"
    with open(output_json, "w") as f:
        json.dump(photo_list, f, indent=4)

    print(f"\n✨ Done! Ripped through {len(photo_list)} photos using {max_cores} cores.")
    print(f"📝 JSON saved to {output_json}")

if __name__ == "__main__":
    main()