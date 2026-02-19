import os
import warnings # Added to silence the text warnings
from PIL import Image
from pathlib import Path

# --- THE FIX ---
# Tell Pillow to ignore the pixel limit for large panoramas
Image.MAX_IMAGE_PIXELS = None 
# Silence the warning messages in the console
warnings.simplefilter('ignore', Image.DecompressionBombWarning)
# ---------------

# --- CONFIGURATION ---
BASE_DIR = Path(__file__).parent
INPUT_DIR = BASE_DIR / "public" / "photos"
OUTPUT_DIR = BASE_DIR / "public" / "optimized_mirror"
MAX_WIDTH = 1920
QUALITY = 75
# ---------------------

def optimize_and_mirror():
    print(f"🚀 Starting Recursive Optimization (Decompression Bomb protection disabled)...")
    print(f"Reading from: {INPUT_DIR}")
    print(f"Writing to: {OUTPUT_DIR}\n")

    extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}

    for root, dirs, files in os.walk(INPUT_DIR):
        relative_path = Path(root).relative_to(INPUT_DIR)
        current_output_folder = OUTPUT_DIR / relative_path
        current_output_folder.mkdir(parents=True, exist_ok=True)

        for file_name in files:
            file_path = Path(root) / file_name
            
            if file_path.suffix in extensions:
                try:
                    with Image.open(file_path) as img:
                        exif_data = img.info.get('exif')

                        # Resize logic
                        w_percent = (MAX_WIDTH / float(img.size[0]))
                        if w_percent < 1.0:
                            new_h = int((float(img.size[1]) * float(w_percent)))
                            img = img.resize((MAX_WIDTH, new_h), Image.Resampling.LANCZOS)

                        target_file = current_output_folder / (file_path.stem + ".webp")

                        img.save(
                            target_file,
                            "WEBP",
                            quality=QUALITY,
                            exif=exif_data,
                            method=6
                        )
                        print(f"✅ Optimized: {relative_path}/{file_name} -> {target_file.name}")
                
                except Exception as e:
                    print(f"❌ Error processing {file_name}: {e}")

    print("\n🎉 Mirroring and Optimization complete!")

if __name__ == "__main__":
    optimize_and_mirror()