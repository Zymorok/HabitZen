"""Готовит картинки для приложения HabitZen.

1) py подготовить_слои.py split   — режет листы (sheets) на отдельные предметы в _разрезка\\
2) посмотреть _разрезка\\ и вписать имена предметов в SHEET_NAMES ниже
3) py подготовить_слои.py export  — обрезает поля, уменьшает, сохраняет WebP в проект
   и генерирует apps/mobile/src/features/onboarding/world/art.ts

NOTE: Панорамы не обрезаются по бокам: их края должны совпасть с краями экрана на первой
и последней странице. У них запоминается только высота самого верхнего непрозрачного пикселя.
"""

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ART = Path(__file__).resolve().parent.parent
RAW = ART / 'сырые'
CUTS = ART / '_разрезка'
# NOTE: Одобренные ракурсы ростка и скалы — папка «3_…» внутри HabitZen-3D.
APPROVED = next(Path(r'C:\Users\vitalii\Desktop\HabitZen-3D').glob('3_*'), None)
PROJECT = Path(r'C:\Users\vitalii\Desktop\HabitZen')
OUT = PROJECT / 'apps' / 'mobile' / 'assets' / 'onboarding'
TS = PROJECT / 'apps' / 'mobile' / 'src' / 'features' / 'onboarding' / 'world' / 'art.ts'

PANORAMAS = ['mountains_day', 'mountains_night', 'hills_day', 'hills_night']
SINGLES = ['garden_bed', 'lake', 'hill_rocks', 'path_bench', 'tree', 'sapling', 'lantern']
SHEETS = ['vegetation_sheet', 'clouds_sheet', 'wolf_sheet', 'dandelion_sheet']
# NOTE: Порядок предметов листа — слева направо, сверху вниз (как их нумерует split).
SHEET_NAMES: dict[str, list[str]] = {
    'vegetation_sheet': ['grass_1', 'grass_2', 'grass_3', 'flowers_1', 'flowers_2', 'bush', 'reeds'],
    'clouds_sheet': ['cloud_1', 'cloud_2', 'cloud_3'],
    'wolf_sheet': ['wolf_walk_1', 'wolf_walk_2', 'wolf_sit', 'wolf_howl', 'wolf_sleep'],
    'dandelion_sheet': ['butterfly_1', 'butterfly_2', 'leaf_green', 'leaf_orange', 'seed'],
}
# WARNING: Больше 1100 px по стороне для телефона не нужно: лишний вес и память.
MAX_SIDE = {'panorama': 2048, 'single': 1000, 'sprite': 520}
ALPHA_MIN = 12


def load_rgba(path: Path) -> Image.Image:
    # NOTE: генератор оставляет на «пустом» фоне одиночные точки с alpha=1…11 — убираем их
    data = np.array(Image.open(path).convert('RGBA'))
    data[..., 3] = np.where(data[..., 3] < ALPHA_MIN, 0, data[..., 3])
    return Image.fromarray(data, 'RGBA')


def solid_below_ridge(img: Image.Image) -> Image.Image:
    """Панорама ниже кромки хребта должна быть непрозрачной, иначе сквозь горы видно небо."""
    data = np.array(img)
    alpha = data[..., 3]
    solid = alpha > 40
    first = np.where(solid.any(axis=0), solid.argmax(axis=0), alpha.shape[0])
    rows = np.arange(alpha.shape[0])[:, None]
    # WARNING: несколько пикселей у самой кромки оставляем как есть — там сглаживание контура
    data[..., 3] = np.where(rows > first[None, :] + 4, 255, alpha)
    return Image.fromarray(data, 'RGBA')


def trim(img: Image.Image, pad: int = 2) -> Image.Image:
    alpha = np.array(img)[:, :, 3]
    ys, xs = np.nonzero(alpha > ALPHA_MIN)
    if len(xs) == 0:
        raise ValueError('пустая картинка')
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad),
                     min(img.width, xs.max() + 1 + pad), min(img.height, ys.max() + 1 + pad)))


def fit(img: Image.Image, max_side: int) -> Image.Image:
    scale = min(1.0, max_side / max(img.size))
    if scale >= 1:
        return img
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def components(img: Image.Image, cell: int = 4, grow: int = 6) -> list[tuple[int, int, int, int]]:
    """Находит отдельные предметы на листе: маска → крупная сетка → расширение → связные области."""
    alpha = np.array(img)[:, :, 3] > ALPHA_MIN
    h, w = alpha.shape
    gh, gw = (h + cell - 1) // cell, (w + cell - 1) // cell
    grid = np.zeros((gh, gw), bool)
    ys, xs = np.nonzero(alpha)
    grid[ys // cell, xs // cell] = True
    # NOTE: расширяем, чтобы травинки одного пучка не стали отдельными предметами
    grown = grid.copy()
    for _ in range(grow):
        g = grown.copy()
        g[1:, :] |= grown[:-1, :]
        g[:-1, :] |= grown[1:, :]
        g[:, 1:] |= grown[:, :-1]
        g[:, :-1] |= grown[:, 1:]
        grown = g
    labels = np.zeros((gh, gw), int)
    boxes = []
    for sy in range(gh):
        for sx in range(gw):
            if not grown[sy, sx] or labels[sy, sx]:
                continue
            label = len(boxes) + 1
            queue = deque([(sy, sx)])
            labels[sy, sx] = label
            y0 = y1 = sy
            x0 = x1 = sx
            area = 0
            while queue:
                y, x = queue.popleft()
                area += grid[y, x]
                y0, y1, x0, x1 = min(y0, y), max(y1, y), min(x0, x), max(x1, x)
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < gh and 0 <= nx < gw and grown[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
            boxes.append((area, (x0 * cell, y0 * cell, min(w, (x1 + 1) * cell), min(h, (y1 + 1) * cell))))
    biggest = max(area for area, _ in boxes)
    boxes = [box for area, box in boxes if area > biggest * 0.02]
    # NOTE: ряды определяются по середине высоты; внутри ряда — слева направо
    rows: list[list[tuple[int, int, int, int]]] = []
    for box in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        middle = (box[1] + box[3]) / 2
        for row in rows:
            row_middle = sum((b[1] + b[3]) / 2 for b in row) / len(row)
            if abs(row_middle - middle) < h * 0.18:
                row.append(box)
                break
        else:
            rows.append([box])
    return [box for row in rows for box in sorted(row, key=lambda b: b[0])]


def split() -> None:
    CUTS.mkdir(exist_ok=True)
    for sheet in SHEETS:
        path = RAW / f'{sheet}.png'
        if not path.exists():
            print(f'нет {path.name}')
            continue
        img = load_rgba(path)
        boxes = components(img)
        for index, box in enumerate(boxes):
            trim(img.crop(box)).save(CUTS / f'{sheet}_{index}.png')
        print(f'{sheet}: предметов {len(boxes)}')


def split_sprout(src: Image.Image) -> tuple[Image.Image, Image.Image, tuple[float, float]]:
    """Делит одобренный росток на «листья со стеблем» и «холмик» по цвету: зелёное качается отдельно."""
    data = np.array(src).astype(np.int32)
    r, g, b, a = data[..., 0], data[..., 1], data[..., 2], data[..., 3]
    green = (g > r + 8) & (g > b + 8) & (a > ALPHA_MIN)
    # NOTE: холмик — коричневая земля и камешки ниже верхней кромки земли. Всё остальное
    # (листья, жёлтая почка, светлая кайма по краям листьев) уходит в качающийся слой.
    brown = (r > g + 12) & (r > b + 20) & (a > 40)
    brown_top = int(np.percentile(np.nonzero(brown)[0], 1))
    rows = np.arange(src.height)[:, None]
    in_mound = (((rows >= brown_top - 2) & ~green) | brown) & (a > 0)
    leaves = data.copy()
    leaves[..., 3] = np.where(in_mound, 0, a)
    mound = data.copy()
    mound[..., 3] = np.where(in_mound, a, 0)
    ys, xs = np.nonzero(green)
    # NOTE: основание стебля — самая нижняя зелёная точка около середины
    middle = src.width / 2
    near = np.abs(xs - middle) < src.width * 0.08
    base_y = ys[near].max()
    base_x = xs[near][ys[near] == base_y].mean()
    return (Image.fromarray(leaves.astype(np.uint8), 'RGBA'),
            Image.fromarray(mound.astype(np.uint8), 'RGBA'),
            (base_x / src.width, base_y / src.height))


def camel(name: str) -> str:
    head, *rest = name.split('_')
    return head + ''.join(part.capitalize() for part in rest)


def export() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries: list[tuple[str, int, int, dict]] = []

    def save(name: str, img: Image.Image, kind: str, extra: dict | None = None) -> None:
        img = fit(img, MAX_SIDE[kind])
        img.save(OUT / f'{name}.webp', 'WEBP', quality=86, method=6)
        entries.append((name, img.width, img.height, extra or {}))
        print(f'{name}: {img.width}x{img.height}')

    for name in PANORAMAS:
        img = solid_below_ridge(load_rgba(RAW / f'{name}.png'))
        alpha = np.array(img)[:, :, 3]
        rows = np.nonzero((alpha > 40).any(axis=1))[0]
        save(name, img, 'panorama', {'top': round(rows.min() / img.height, 4)})
    for name in SINGLES:
        save(name, trim(load_rgba(RAW / f'{name}.png')), 'single')
    for sheet in SHEETS:
        names = SHEET_NAMES[sheet]
        img = load_rgba(RAW / f'{sheet}.png')
        boxes = components(img)
        if len(names) != len(boxes):
            sys.exit(f'{sheet}: предметов {len(boxes)}, а имён {len(names)} — проверь SHEET_NAMES')
        crops = [trim(img.crop(box)) for box in boxes]
        # NOTE: весь лист уменьшается одним коэффициентом — у позы «спит» и «идёт»
        # волк остаётся одного размера, иначе он «прыгал» бы в росте при смене позы.
        factor = min(1.0, MAX_SIDE['sprite'] / max(max(c.size) for c in crops))
        for name, crop in zip(names, crops):
            if name:
                size = (max(1, round(crop.width * factor)), max(1, round(crop.height * factor)))
                save(name, crop.resize(size, Image.LANCZOS), 'sprite')

    sprout = trim(load_rgba(APPROVED / 'Росток' / 'сырые' / '1_Front.png'))
    leaves, mound, pivot = split_sprout(sprout)
    save('sprout_leaves', leaves, 'single', {'pivotX': round(pivot[0], 4), 'pivotY': round(pivot[1], 4)})
    save('sprout_mound', mound, 'single')
    save('rock', trim(load_rgba(APPROVED / 'Скала' / 'сырые' / '1_Front.png')), 'single')

    lines = [
        '// NOTE: Файл создан скриптом HabitZen-Art\\_инструменты\\подготовить_слои.py. Не править руками.',
    ]
    for name, *_ in entries:
        lines.append(f"import {camel(name)} from '../../../../assets/onboarding/{name}.webp';")
    lines.append('')
    lines.append('export const art = {')
    for name, width, height, extra in entries:
        fields = [f'source: {camel(name)}', f'width: {width}', f'height: {height}']
        fields += [f'{key}: {value}' for key, value in extra.items()]
        lines.append(f'  {camel(name)}: {{ {", ".join(fields)} }},')
    lines.append('} as const;')
    TS.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'art.ts: {len(entries)} картинок')


if __name__ == '__main__':
    {'split': split, 'export': export}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: sys.exit(__doc__))()
