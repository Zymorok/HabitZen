"""Звуки фокуса HabitZen: дождь, лес и белый шум (HZ-R16).

NOTE: Звуки синтезируются этим скриптом, а не берутся из чужих записей, — поэтому нет вопросов
с лицензией, а файлы можно пересобрать. Каждый файл — бесшовная петля: конец плавно
перетекает в начало, и при повторе не слышно щелчка.

Запуск из корня проекта:  py resources/design/sounds/make_focus_sounds.py
"""

import wave
from pathlib import Path

import numpy as np

RATE = 22050
SECONDS = 14
FADE = 1.5
OUT = Path(__file__).resolve().parents[3] / 'apps' / 'mobile' / 'assets' / 'sounds'
rng = np.random.default_rng(20261019)


def one_pole_lowpass(signal, cutoff):
    alpha = 1 - np.exp(-2 * np.pi * cutoff / RATE)
    out = np.empty_like(signal)
    acc = 0.0
    for index, value in enumerate(signal):
        acc += alpha * (value - acc)
        out[index] = acc
    return out


def highpass(signal, cutoff):
    return signal - one_pole_lowpass(signal, cutoff)


def slow_wave(count, period_s, depth):
    """Медленное «дыхание» громкости, чтобы фон не звучал как ровный шипящий шум."""
    phase = rng.uniform(0, 2 * np.pi)
    t = np.arange(count) / RATE
    return 1 - depth / 2 + depth / 2 * np.sin(2 * np.pi * t / period_s + phase)


def seamless(signal):
    """Последние FADE секунд накладываются на начало равномощным переходом."""
    fade = int(FADE * RATE)
    body = signal[:-fade].copy()
    tail = signal[-fade:]
    ramp = np.linspace(0, np.pi / 2, fade)
    body[:fade] = body[:fade] * np.sin(ramp) + tail * np.cos(ramp)
    return body


def normalize(signal, peak_db=-6.0):
    peak = np.max(np.abs(signal)) or 1.0
    return signal / peak * 10 ** (peak_db / 20)


def save(name, signal):
    OUT.mkdir(parents=True, exist_ok=True)
    data = (np.clip(signal, -1, 1) * 32767).astype('<i2')
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(data.tobytes())
    print(f'{name}.wav: {len(data) / RATE:.1f} с, {len(data) * 2 // 1024} КБ')


def rain():
    count = int((SECONDS + FADE) * RATE)
    hiss = highpass(one_pole_lowpass(rng.normal(0, 1, count), 3200), 400)
    hiss *= slow_wave(count, 7.0, 0.25)
    drops = np.zeros(count)
    # NOTE: Капли — короткие затухающие щелчки разной высоты и силы, около 30 в секунду.
    for start in rng.integers(0, count - 2000, int(30 * SECONDS)):
        length = int(rng.uniform(0.004, 0.02) * RATE)
        t = np.arange(length) / RATE
        tone = np.sin(2 * np.pi * rng.uniform(1500, 4500) * t)
        drops[start:start + length] += tone * np.exp(-t * rng.uniform(250, 600)) * rng.uniform(0.2, 1)
    low = one_pole_lowpass(rng.normal(0, 1, count), 180) * 4
    return normalize(seamless(hiss * 0.8 + drops * 0.35 + low * 0.5), -7)


def chirp(length_s, f_from, f_to):
    count = int(length_s * RATE)
    t = np.arange(count) / RATE
    freq = np.linspace(f_from, f_to, count)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    envelope = np.sin(np.pi * t / length_s) ** 2
    return np.sin(phase) * envelope


def forest():
    count = int((SECONDS + FADE) * RATE)
    wind = one_pole_lowpass(np.cumsum(rng.normal(0, 1, count)) * 0.02, 600)
    wind = highpass(wind, 40) * slow_wave(count, 9.0, 0.6)
    leaves = highpass(one_pole_lowpass(rng.normal(0, 1, count), 2500), 700)
    leaves *= slow_wave(count, 4.5, 0.8) ** 2
    birds = np.zeros(count)
    # NOTE: Птицы поют короткими фразами из 2–5 нот раз в несколько секунд.
    moment = rng.uniform(0.3, 1.5)
    while moment < SECONDS - 1:
        start = int(moment * RATE)
        base = rng.uniform(2600, 4200)
        for _ in range(rng.integers(2, 6)):
            note = chirp(rng.uniform(0.06, 0.16), base, base * rng.uniform(0.75, 1.3))
            end = min(count, start + len(note))
            birds[start:end] += note[: end - start] * rng.uniform(0.4, 0.9)
            start += len(note) + int(rng.uniform(0.03, 0.09) * RATE)
        moment += rng.uniform(1.6, 3.8)
    return normalize(seamless(wind / (np.max(np.abs(wind)) or 1) * 0.6 + leaves * 0.12 + birds * 0.22), -8)


def white_noise():
    count = int((SECONDS + FADE) * RATE)
    # NOTE: Чуть смягчённый белый шум: верхние частоты приглушены, чтобы не резал слух.
    noise = one_pole_lowpass(rng.normal(0, 1, count), 6000)
    return normalize(seamless(noise), -10)


if __name__ == '__main__':
    save('rain', rain())
    save('forest', forest())
    save('white_noise', white_noise())
