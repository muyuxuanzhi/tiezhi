# -*- coding: utf-8 -*-
"""把资料包里的素材整理进游戏目录：图片按素材标识命名，音频转 mp3。"""
import os, re, glob, shutil, subprocess, sys
import imageio_ffmpeg

SRC = glob.glob(os.path.join(os.environ["TEMP"], "tz_pkg", "*"))[0]
DST = r"e:\zhuomian\回复\tiezhi"
IMG = os.path.join(DST, "assets", "img")
SND = os.path.join(DST, "assets", "snd")
DOC = os.path.join(DST, "docs")
for d in (IMG, SND, DOC):
    os.makedirs(d, exist_ok=True)

# 图片：文件名形如 中文名_标识.ext -> 标识.ext
n = 0
for f in glob.glob(os.path.join(SRC, "03_图片素材", "**", "*.*"), recursive=True):
    base = os.path.basename(f)
    if not re.search(r"_[A-Za-z0-9]+\.(png|jpg)$", base):
        continue
    key = re.search(r"_([A-Za-z0-9]+)\.(png|jpg)$", base)
    ext = key.group(2)
    shutil.copyfile(f, os.path.join(IMG, key.group(1) + "." + ext))
    n += 1
print("images", n)

# 音频：wav -> mp3
ff = imageio_ffmpeg.get_ffmpeg_exe()
m = 0
for f in glob.glob(os.path.join(SRC, "04_声音素材", "制作原音频", "*.wav")):
    base = os.path.basename(f)
    key = re.search(r"_([A-Za-z0-9]+)\.wav$", base).group(1)
    out = os.path.join(SND, key + ".mp3")
    br = "96k" if key == "bgm" else "112k"
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", f, "-ac", "2", "-ar", "44100", "-b:a", br, out], check=True)
    m += 1
print("audio", m)

# 设计资料：md / csv 放进 docs
for sub in ("00_阅读说明.md",):
    shutil.copyfile(os.path.join(SRC, sub), os.path.join(DOC, "资料包阅读说明.md"))
for f in glob.glob(os.path.join(SRC, "01_玩法与设计", "*")) + glob.glob(os.path.join(SRC, "02_制作流程", "*")):
    shutil.copyfile(f, os.path.join(DOC, os.path.basename(f)))
print(sorted(os.listdir(IMG))[:5], len(os.listdir(IMG)))
tot = sum(os.path.getsize(os.path.join(r, x)) for r, _, fs in os.walk(os.path.join(DST, "assets")) for x in fs)
print("assets MB", round(tot / 1e6, 2))
