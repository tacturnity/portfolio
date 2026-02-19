import os
import json
import warnings
from PIL import Image, ExifTags
from pathlib import Path

# --- CONFIG ---
Image.MAX_IMAGE_PIXELS = None 
warnings.simplefilter('ignore', Image.DecompressionBombWarning)

BASE_PATH = "public/photos"
OPTIMIZED_BASE = "public/optimized2" # You might want to change this back to "public/optimized"
CATEGORIES = ["animals", "misc", "people", "panos"]
QUALITY_MEDIUM = 80
QUALITY_SMALL = 60
# --------------

photo_list = []

def get_metadata(filepath):
    """Extracts EXIF data, specifically looking into the SubIFD for exposure settings."""
    date, iso, aperture, shutter = "Unknown", "N/A", "N/A", "N/A"
    
    try:
        with Image.open(filepath) as img:
            exif = img.getexif()
            if not exif:
                return date, iso, aperture, shutter
            
            # 1. Create a dictionary with the Base EXIF data
            all_tags = {k: v for k, v in exif.items()}

            # 2. Extract the Exif SubIFD (Tag 34665) where ISO, Aperture, Shutter live
            # Pillow >= 8.2.0 required for get_ifd
            exif_ifd = exif.get_ifd(34665)
            all_tags.update(exif_ifd)

            # Helper to safely get value
            def get_val(tag_id):
                return all_tags.get(tag_id)

            # --- Extract Date (DateTimeOriginal: 36867 or DateTime: 306) ---
            date_raw = get_val(36867) or get_val(306)
            if date_raw:
                # Format: YYYY:MM:DD HH:MM:SS -> YYYY-MM-DD
                date = str(date_raw).split(' ')[0].replace(':', '-')

            # --- Extract ISO (PhotographicSensitivity: 34855) ---
            iso_val = get_val(34855)
            if iso_val:
                iso = str(iso_val)

            # --- Extract Aperture (FNumber: 33437) ---
            f_val = get_val(33437)
            if f_val:
                try:
                    val = float(f_val)
                    # Show as integer if it's a whole number (e.g., f/2.0 -> f/2)
                    if val.is_integer():
                        aperture = f"f/{int(val)}"
                    else:
                        aperture = f"f/{val:.1f}"
                except:
                    aperture = str(f_val)

            # --- Extract Shutter (ExposureTime: 33434) ---
            shut_val = get_val(33434)
            if shut_val:
                try:
                    val = float(shut_val)
                    if val < 1:
                        # Convert decimals (0.005) to fractions (1/200)
                        shutter = f"1/{int(round(1/val))}"
                    else:
                        # Long exposures (e.g., 2.0 -> 2s)
                        shutter = f"{int(val) if val.is_integer() else val}s"
                except:
                    shutter = str(shut_val)

    except Exception as e:
        print(f"⚠️ Meta Error on {os.path.basename(filepath)}: {e}")
        pass
        
    return date, iso, aperture, shutter

def process_file(full_input_path, category, rel_path, filename):
    """Resizes, converts to WebP, and maintains folder structure."""
    # Ensure we don't double up extensions if file is already .webp
    if filename.lower().endswith('.webp'):
        clean_name = filename
    else:
        clean_name = os.path.splitext(filename)[0] + ".webp"
    
    medium_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "medium")
    small_dir = os.path.join(OPTIMIZED_BASE, category, rel_path, "small")
    os.makedirs(medium_dir, exist_ok=True)
    os.makedirs(small_dir, exist_ok=True)

    with Image.open(full_input_path) as img:
        exif_raw = img.info.get('exif')
        width, height = img.size
        
        # Auto-rotate (Pillow usually handles WebP orientation automatically, but just in case)
        try:
            exif = img.getexif()
            if exif:
                orientation = exif.get(274)
                if orientation == 3: img = img.rotate(180, expand=True)
                elif orientation == 6: img = img.rotate(270, expand=True)
                elif orientation == 8: img = img.rotate(90, expand=True)
        except: pass

        # Save Medium
        medium_path = os.path.join(medium_dir, clean_name)
        m_img = img.copy()
        m_img.thumbnail((1200, 1200))
        # If input is WebP, we strip exif_raw to avoid issues, or keep it if you want metadata in optimized files
        m_img.save(medium_path, "WEBP", quality=QUALITY_MEDIUM, method=6)

        # Save Small
        small_path = os.path.join(small_dir, clean_name)
        s_img = img.copy()
        s_img.thumbnail((600, 600))
        s_img.save(small_path, "WEBP", quality=QUALITY_SMALL, method=6)

    return width, height, clean_name

print("🚀 Starting Recursive WebP Optimization...")

id_counter = 1
for cat in CATEGORIES:
    cat_path = os.path.join(BASE_PATH, cat)
    if not os.path.exists(cat_path):
        continue

    for root, dirs, files in os.walk(cat_path):
        rel_path = os.path.relpath(root, cat_path)
        if rel_path == ".": rel_path = ""

        for file in files:
            # ADDED .webp support here
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                full_input_path = os.path.join(root, file)
                
                print(f"📸 [{cat.upper()}] Processing: {os.path.join(rel_path, file)}")
                
                # 1. Process Image
                w, h, webp_name = process_file(full_input_path, cat, rel_path, file)
                
                # 2. Get Metadata (New Function)
                date, iso, ap, shut = get_metadata(full_input_path)
                
                url_rel = rel_path.replace(os.sep, '/')
                if url_rel: url_rel += '/'

                photo_list.append({
                    # ADD "/portfolio" to the start of these 3 lines:
                    "url_large": f"/portfolio/photos/{cat}/{url_rel}{file}",
                    "url_medium": f"/portfolio/optimized2/{cat}/{url_rel}medium/{webp_name}",
                    "url_small": f"/portfolio/optimized2/{cat}/{url_rel}small/{webp_name}",
                    
                    "category": cat.capitalize(),
                    "title": file.split('.')[0].replace('_', ' ').replace('-', ' ').title(),
                    "date": date, "iso": iso, "aperture": ap, "shutter": shut,
                    "width": w, "height": h
                })

# --- NEW STEP: SORT BY DATE ---
print("\n🔄 Sorting photos by date (newest first)...")
# Sorts by date string (YYYY-MM-DD). "Unknown" will likely go to the end.
photo_list.sort(key=lambda x: x['date'], reverse=True)

# Re-assign IDs based on sorted order
for index, photo in enumerate(photo_list):
    photo['id'] = index + 1

# Write final JSON
output_json = "src/photos.json"
with open(output_json, "w") as f:
    json.dump(photo_list, f, indent=4)

print(f"\n✨ Done! Processed {len(photo_list)} photos recursively.")
print(f"📝 JSON saved to {output_json} (Sorted by date)")