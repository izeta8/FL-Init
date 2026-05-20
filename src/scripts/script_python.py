"""
FL Init - Script to download and process YouTube videos for FL Studio projects.

This script handles:
- YouTube audio download
- Key and BPM detection
- FL Studio project creation
- Audio stem separation (optional)
"""

import os
import shutil
import sys
import platform
import subprocess
import argparse
import stat
from typing import Optional, Dict, Any

from pytubefix import YouTube
from moviepy.editor import AudioFileClip
import urllib.parse

import pyflp
import demucs.separate
import shlex

import librosa
import numpy as np

import torch

NOTES: list[str] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

MAJOR_PROFILE: np.ndarray = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE: np.ndarray = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def output_message(message: str, error: bool = False) -> None:
    """Print a message to stdout or stderr."""
    output_channel = sys.stderr if error else sys.stdout
    print(f"\n{message}", file=output_channel)
    sys.stdout.flush()


def check_gpu_availability() -> str:
    """Check for CUDA availability and return the device string."""
    return "cuda" if torch.cuda.is_available() else "cpu"


def is_video_valid(url: str) -> bool:
    """Check if the provided URL is a valid YouTube URL."""
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        return False
    if parsed_url.netloc not in ("www.youtube.com", "youtube.com", "youtu.be"):
        return False
    return True


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def rotate_profile(profile: np.ndarray, n: int) -> np.ndarray:
    """Rotate the profile 'n' positions (to transpose the template)."""
    return np.roll(profile, n)


def detect_key(audio_path: str) -> str:
    """
    Detect the musical key of an audio file using chromagram analysis.

    Args:
        audio_path: Path to the audio file.

    Returns:
        String with detected key and mode (e.g., "C Major").
    """
    y, sr = librosa.load(audio_path)
    chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chromagram, axis=1)

    best_score = -np.inf
    best_key: Optional[str] = None
    best_mode: Optional[str] = None

    for i in range(12):
        profile_rot = rotate_profile(MAJOR_PROFILE, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = NOTES[i]
            best_mode = 'Major'

    for i in range(12):
        profile_rot = rotate_profile(MINOR_PROFILE, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = NOTES[i]
            best_mode = 'Minor'

    return f"{best_key} {best_mode} (Score: {round(best_score, 2)})"


def download_audio(url: str, assets_path: str, audio_extension: str) -> Dict[str, str]:
    """
    Download audio from YouTube and convert to specified format.

    Args:
        url: YouTube video URL.
        assets_path: Directory to save the audio.
        audio_extension: Output format (mp3/wav).

    Returns:
        Dictionary with audio_path and assets_path.
    """
    try:
        output_message("Starting audio download...")

        yt = YouTube(url)
        title = yt.title
        title = ''.join(char for char in title if char.isalnum() or char in " -_")
        output_message(f"Youtube Title: {title}")

        os.makedirs(assets_path, exist_ok=True)

        audio_stream = yt.streams.filter(only_audio=True).first()
        audio_file_path = audio_stream.download(output_path=assets_path, filename=f"{title}.mp4")
        audio_out_path = os.path.join(assets_path, f"{title}.{audio_extension}")

        original_stderr = sys.stderr
        sys.stderr = sys.stdout

        audio_clip = AudioFileClip(audio_file_path)
        audio_clip.write_audiofile(audio_out_path)
        audio_clip.close()

        sys.stderr = original_stderr
        os.remove(audio_file_path)

        return {"audio_path": audio_out_path, "assets_path": assets_path, "youtube_title": title}

    except Exception as e:
        output_message(f"Error downloading audio: {str(e)}", error=True)
        raise


def create_info_file(project_path: str, key: str, bpm: int, youtube_title: str) -> None:
    """Create a text file with original song information."""
    try:
        info_path = os.path.join(project_path, "Original Song Info.txt")
        with open(info_path, "w") as file:
            file.write(f"Youtube title: {youtube_title}\n")
            file.write("Original Song Info: \n")
            file.write(f"  -> Key: {key}\n")
            file.write(f"  -> BPM: {str(bpm)}\n")
    except Exception as err:
        output_message(f"Error creating the original song info file: {err}")


def separate_audio(assets_path: str, audio_path: str, audio_extension: str, threads: int, device: str) -> None:
    """Separate audio into stems using Demucs."""
    stems_base = os.path.join(assets_path, "stems")
    os.makedirs(stems_base, exist_ok=True)

    if audio_extension == 'mp3':
        command = f'--verbose -n mdx_extra --jobs {threads} -d {device} --mp3 --out "{stems_base}" "{audio_path}"'
    else:
        command = f'--verbose -n mdx_extra --jobs {threads} -d {device} --out "{stems_base}" "{audio_path}"'

    args = shlex.split(command)
    output_message(f"Stem extraction in progress... Threads: {threads}, Extension: {audio_extension}")

    original_stderr = sys.stderr
    try:
        sys.stderr = sys.stdout
        demucs.separate.main(args)
    except Exception as e:
        output_message(f"Error in the stems separation: {str(e)}", error=True)
    finally:
        sys.stderr = original_stderr
        output_message("The split is complete. Moving the files to the stems folder...")
        move_stems_up(stems_base)
        open_folder(stems_base)


def move_stems_up(stems_base: str) -> None:
    """Move stem files from Demucs output structure to the base folder."""

    def handle_remove_readonly(func: Any, path: str, exc_info: Any) -> None:
        os.chmod(path, stat.S_IWRITE)
        func(path)

    mdx_extra_dir = os.path.join(stems_base, "mdx_extra")

    if os.path.exists(mdx_extra_dir):
        try:
            contents = os.listdir(mdx_extra_dir)
            if len(contents) == 1 and os.path.isdir(os.path.join(mdx_extra_dir, contents[0])):
                inner_dir = os.path.join(mdx_extra_dir, contents[0])
                for item in os.listdir(inner_dir):
                    src_path = os.path.join(inner_dir, item)
                    dst_path = os.path.join(stems_base, item)
                    shutil.move(src_path, dst_path)
            else:
                for item in contents:
                    src_path = os.path.join(mdx_extra_dir, item)
                    dst_path = os.path.join(stems_base, item)
                    shutil.move(src_path, dst_path)

            shutil.rmtree(mdx_extra_dir, onerror=handle_remove_readonly)
            output_message(f"Successfully removed: {mdx_extra_dir}")
        except Exception as e:
            output_message(f"Final removal failed: {str(e)}", error=True)


def open_folder(path: str) -> None:
    """Open the directory in the file explorer."""
    system = platform.system()
    if system == 'Windows':
        os.startfile(path)
    elif system == 'Darwin':
        subprocess.Popen(['open', path])
    else: # Linux
        subprocess.Popen(['xdg-open', path])


def validate_project_name(name: str) -> None:
    """Validate that the project name is valid for Windows file system."""
    invalid_chars = '<>:"/\\|?*'
    if any(char in invalid_chars for char in name):
        raise ValueError("The project name contains characters not allowed by Windows.")

    if name.endswith('.') or name.endswith(' '):
        raise ValueError("Invalid project name. Cannot end with period or space.")


def create_flp(project_path: str, project_name: str, template_path: Optional[str], key: str, bpm: int) -> None:
    """Create FL Studio project file from template."""
    if template_path:
        if os.path.isfile(template_path) and template_path.endswith('.flp'):
            project = pyflp.parse(template_path)
            project.comments = f"Original Song: {key} | {bpm}BPM"
            output_path = os.path.join(project_path, f'{project_name}.flp')
            pyflp.save(project, output_path)
            output_message(f"Using valid template from {template_path} to create the project")
        else:
            raise ValueError(f"The provided template is not a valid .flp file: {template_path}")


def get_song_bpm(file_path: str) -> int:
    """Estimate BPM of an audio file."""
    y, sr = librosa.load(file_path)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    bpm = int(np.round(tempo, 0))
    return bpm - 1


def main(args: argparse.Namespace) -> int:
    """Main entry point for the script."""
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    if not args.url or not args.project_location or not args.project_name:
        raise ValueError("Fill the required fields, please.")

    url = args.url
    project_location = args.project_location
    project_name = args.project_name
    separate_stems = args.separate_stems
    template_path = args.template_path
    project_path = os.path.join(project_location, project_name)
    audio_extension = args.audio_extension
    threads = args.threads

    validate_project_name(project_name)

    device_to_use = check_gpu_availability()

    try:
        if os.path.exists(project_path):
            raise FileExistsError(f"The destination directory '{project_path}' already exists.")

        assets_path = os.path.join(project_path, 'assets')
        result = download_audio(url, assets_path, audio_extension)
        audio_path = result["audio_path"]
        youtube_title = result.get("youtube_title", "")

        key = detect_key(audio_path)
        bpm = get_song_bpm(audio_path)

        create_info_file(project_path, key, bpm, youtube_title)

        create_flp(project_path, project_name, template_path, key, bpm)

        open_folder(project_path)

        if separate_stems:
            output_message("The project has been created. The stem extraction process has just begun.")
            output_message(f"Using device '{device_to_use.upper()}' for the separation process.")
            separate_audio(assets_path, audio_path, audio_extension, threads, device_to_use)
        else:
            output_message("The project has been created. You can create another one if you wish.")

    except ValueError as ve:
        output_message(f"Validation error: {str(ve)}", error=True)
    except Exception as e:
        output_message(f"Error during download or processing: {str(e)}", error=True)

    return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script to download and process YouTube videos")
    parser.add_argument("project_location", help="Destination directory path")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("project_name", help="Project name, used as the directory name")
    parser.add_argument("--separate-stems", action='store_true', help="Separate audio stems")
    parser.add_argument("--template-path", help="Path to the .flp template")
    parser.add_argument("--audio-extension", choices=['wav', 'mp3'], default='wav', help="Audio output extension")
    parser.add_argument("--threads", type=int, default=4, help="Number of threads for demucs")

    parsed_args = parser.parse_args()
    main(parsed_args)