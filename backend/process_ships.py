import os
import shutil
from PIL import Image

def make_square(img):
    width, height = img.size
    if width == height:
        return img
    max_side = max(width, height)
    new_img = Image.new('RGBA', (max_side, max_side), (0, 0, 0, 0))
    offset = ((max_side - width) // 2, (max_side - height) // 2)
    new_img.paste(img, offset)
    return new_img

def process_ship(src_path, dest_path):
    if not os.path.exists(src_path):
        print(f"Source file not found: {src_path}")
        return
        
    print(f"Processing {src_path} -> {dest_path}")
    img = Image.open(src_path).convert('RGBA')
    width, height = img.size
    data = img.load()
    
    # 1. Sample border pixels to detect background colors
    border_colors = []
    # top/bottom borders
    for x in range(width):
        border_colors.append(data[x, 0][:3])
        border_colors.append(data[x, height - 1][:3])
    # left/right borders
    for y in range(height):
        border_colors.append(data[0, y][:3])
        border_colors.append(data[width - 1, y][:3])
        
    # Count frequencies of each color
    color_counts = {}
    for c in border_colors:
        color_counts[c] = color_counts.get(c, 0) + 1
        
    # Sort by frequency and select colors that represent background
    sorted_colors = sorted(color_counts.items(), key=lambda x: x[1], reverse=True)
    main_bg_colors = [item[0] for item in sorted_colors[:4] if item[1] > len(border_colors) * 0.02]
    
    print(f"Detected background colors for {os.path.basename(src_path)}: {main_bg_colors}")
    
    # 2. Flood fill starting from all border pixels
    visited = set()
    to_visit = []
    
    for x in range(width):
        to_visit.append((x, 0))
        to_visit.append((x, height - 1))
    for y in range(height):
        to_visit.append((0, y))
        to_visit.append((width - 1, y))
        
    background_pixels = set()
    
    # Check if a pixel color matches the detected background colors
    def is_bg(r, g, b):
        for bg_r, bg_g, bg_b in main_bg_colors:
            if abs(r - bg_r) < 18 and abs(g - bg_g) < 18 and abs(b - bg_b) < 18:
                return True
        return False

    while to_visit:
        curr = to_visit.pop()
        if curr in visited:
            continue
        visited.add(curr)
        
        x, y = curr
        r, g, b, a = data[x, y]
        
        if is_bg(r, g, b) or a == 0:
            background_pixels.add((x, y))
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    to_visit.append((nx, ny))
                    
    # 3. Find non-background pixels
    non_bg_pixels = set()
    for x in range(width):
        for y in range(height):
            if (x, y) not in background_pixels:
                non_bg_pixels.add((x, y))
                
    # 4. Connected components group
    components = []
    comp_visited = set()
    
    for px in non_bg_pixels:
        if px in comp_visited:
            continue
        comp = []
        queue = [px]
        while queue:
            curr = queue.pop()
            if curr in comp_visited:
                continue
            comp_visited.add(curr)
            comp.append(curr)
            cx, cy = curr
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = cx + dx, cy + dy
                    if (nx, ny) in non_bg_pixels and (nx, ny) not in comp_visited:
                        queue.append((nx, ny))
        components.append(comp)
        
    # 5. Keep components larger than 100 pixels (main ship, wings, flames)
    if components:
        components.sort(key=len, reverse=True)
        # Keep the largest component (always the main ship body)
        # and any component larger than 100 pixels
        for comp in components[1:]:
            if len(comp) > 100:
                continue
            else:
                for x, y in comp:
                    background_pixels.add((x, y))

    # Apply transparency
    for x, y in background_pixels:
        data[x, y] = (0, 0, 0, 0)
        
    # 6. Autocrop and resize
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        img = make_square(img)
        
    img = img.resize((256, 256), Image.Resampling.LANCZOS)
    img.save(dest_path, 'PNG')
    print(f"Successfully saved to {dest_path}")

# Original unmodified image artifacts from Gemini brain logs
src_phantom = '/home/vinitprajapati/.gemini/antigravity/brain/810b706c-4316-4537-b223-e5acdfb1fa23/player_phantom_1781928001184.png'
src_phoenix = '/home/vinitprajapati/.gemini/antigravity/brain/810b706c-4316-4537-b223-e5acdfb1fa23/player_phoenix_1781928014155.png'
src_monarch = '/home/vinitprajapati/.gemini/antigravity/brain/810b706c-4316-4537-b223-e5acdfb1fa23/player_monarch_1781928026441.png'

# Dest paths in frontend public directory
dest_phantom = '/home/vinitprajapati/shooting game/frontend/public/player_phantom.png'
dest_phoenix = '/home/vinitprajapati/shooting game/frontend/public/player_phoenix.png'
dest_monarch = '/home/vinitprajapati/shooting game/frontend/public/player_monarch.png'

process_ship(src_phantom, dest_phantom)
process_ship(src_phoenix, dest_phoenix)
process_ship(src_monarch, dest_monarch)

# Process player.png (standard ship) using the backup file as source
player_original = '/home/vinitprajapati/shooting game/frontend/public/player.png'
player_backup = '/home/vinitprajapati/shooting game/frontend/public/player_backup.png'

if os.path.exists(player_backup):
    process_ship(player_backup, player_original)
else:
    process_ship(player_original, player_original)
