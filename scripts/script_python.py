"""
FL Init - Script to download and process songs for FL Studio projects.

This script handles:
- YouTube / SoundCloud audio download
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
import contextlib
from typing import Optional, Dict, Any, Iterator
import urllib.parse

import pyflp

NOTES: list[str] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

YOUTUBE_DOMAINS: tuple[str, ...] = ('youtube.com', 'youtu.be', 'music.youtube.com', 'm.youtube.com')
SOUNDCLOUD_DOMAINS: tuple[str, ...] = ('soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com', 'soundcloud.app.goo.gl')

SOURCE_LABELS: dict[str, str] = {'youtube': 'YouTube', 'soundcloud': 'SoundCloud'}

TUNING_SAMPLE_SECONDS: int = 30

MAJOR_PROFILE: list[float] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE: list[float] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def output_message(message: str, error: bool = False) -> None:
    """Print a message to stdout or stderr."""
    output_channel = sys.stderr if error else sys.stdout
    print(f"\n{message}", file=output_channel)
    sys.stdout.flush()


@contextlib.contextmanager
def redirected_stderr(target: Any) -> Iterator[None]:
    """
    Temporarily point stderr somewhere else.

    Third party libraries write their progress and notices to stderr, and the app flags
    every stderr line as an error, so they are redirected while those libraries run.
    """
    original_stderr = sys.stderr
    sys.stderr = target
    try:
        yield
    finally:
        sys.stderr = original_stderr


def stderr_to_stdout() -> Any:
    """Route stderr into stdout so its output is logged as regular progress."""
    return redirected_stderr(sys.stdout)


def discarded_stderr() -> Any:
    """Drop everything written to stderr."""
    import io
    return redirected_stderr(io.StringIO())


def check_gpu_availability() -> str:
    """Check for CUDA availability and return the device string."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def detect_source(url: str) -> Optional[str]:
    """
    Detect the platform a URL belongs to.

    Args:
        url: Song URL.

    Returns:
        'youtube', 'soundcloud' or None if the platform is not supported.
    """
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        return None

    host = parsed_url.netloc.lower().split(':')[0]
    if host.startswith('www.'):
        host = host[4:]

    if host in YOUTUBE_DOMAINS:
        return 'youtube'
    if host in SOUNDCLOUD_DOMAINS:
        return 'soundcloud'
    return None


def sanitize_title(title: str) -> str:
    """Strip characters that are not safe for a file name."""
    cleaned = ''.join(char for char in title if char.isalnum() or char in " -_").strip()
    return cleaned or "track"


def cosine_similarity(a: Any, b: Any) -> float:
    """Calculate cosine similarity between two vectors."""
    import numpy as np
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def rotate_profile(profile: Any, n: int) -> Any:
    """Rotate the profile 'n' positions (to transpose the template)."""
    import numpy as np
    return np.roll(profile, n)


def estimate_tuning(y: Any, sr: int) -> float:
    """
    Estimate how far the recording is detuned, in fractions of a semitone.

    librosa's own estimate_tuning() crashes the interpreter here: it relies on
    piptrack(), which segfaults with the pinned librosa 0.11 / numpy 2.1 combination.
    yin() gives the same answer without touching that code path.
    """
    import librosa

    try:
        # A fragment is enough, and keeps this off the critical path for long tracks.
        segment = y[:sr * TUNING_SAMPLE_SECONDS]
        f0 = librosa.yin(segment, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        return float(librosa.pitch_tuning(f0))
    except Exception as e:
        output_message(f"Could not estimate tuning, assuming standard pitch: {e}")
        return 0.0


def detect_key(audio_path: str) -> str:
    """
    Detect the musical key of an audio file using chromagram analysis.

    Args:
        audio_path: Path to the audio file.

    Returns:
        String with detected key and mode (e.g., "C Major").
    """
    import librosa
    import numpy as np

    major_profile_np = np.array(MAJOR_PROFILE)
    minor_profile_np = np.array(MINOR_PROFILE)

    y, sr = librosa.load(audio_path)
    chromagram = librosa.feature.chroma_cqt(y=y, sr=sr, tuning=estimate_tuning(y, sr))
    chroma_mean = np.mean(chromagram, axis=1)

    best_score = -np.inf
    best_key: Optional[str] = None
    best_mode: Optional[str] = None

    for i in range(12):
        profile_rot = rotate_profile(major_profile_np, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = NOTES[i]
            best_mode = 'Major'

    for i in range(12):
        profile_rot = rotate_profile(minor_profile_np, i)
        score = cosine_similarity(chroma_mean, profile_rot)
        if score > best_score:
            best_score = score
            best_key = NOTES[i]
            best_mode = 'Minor'

    return f"{best_key} {best_mode} (Score: {round(best_score, 2)})"


def convert_to_audio_format(source_file: str, assets_path: str, title: str, audio_extension: str) -> str:
    """
    Convert a downloaded media file to the requested audio format and remove the source.

    Args:
        source_file: Path to the downloaded file.
        assets_path: Directory where the converted audio is written.
        title: File name (without extension) of the output.
        audio_extension: Output format (mp3/wav).

    Returns:
        Path to the converted audio file.
    """
    from moviepy.audio.io.AudioFileClip import AudioFileClip

    audio_out_path = os.path.join(assets_path, f"{title}.{audio_extension}")

    with stderr_to_stdout():
        audio_clip = AudioFileClip(source_file)
        audio_clip.write_audiofile(audio_out_path)
        audio_clip.close()

    os.remove(source_file)

    return audio_out_path


class YtDlpLogger:
    """Route yt-dlp messages through the script output channels."""

    def debug(self, msg: str) -> None:
        pass

    def info(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        # Deprecation notices are aimed at the developer, not at the user creating a project.
        if msg.startswith("Deprecated Feature"):
            return
        # The bundled runtime ships no JS engine, so this notice is not actionable for the
        # user; yt-dlp still resolves YouTube audio through the clients that need no JS.
        if "No supported JavaScript runtime" in msg:
            return
        output_message(f"Warning: {msg}")

    def error(self, msg: str) -> None:
        output_message(msg, error=True)


def build_download_progress_hook(source_label: str) -> Any:
    """Build a yt-dlp progress hook that reports the download percentage."""
    last_reported = {"percent": -1}

    def hook(status: Dict[str, Any]) -> None:
        if status.get("status") == "downloading":
            total = status.get("total_bytes") or status.get("total_bytes_estimate")
            if not total:
                return
            percent = int(status.get("downloaded_bytes", 0) * 100 / total)
            if percent >= last_reported["percent"] + 5:
                last_reported["percent"] = percent
                output_message(f"Downloading from {source_label}... {percent}%")
        elif status.get("status") == "finished":
            output_message("Download finished. Converting the audio...")

    return hook


def build_ydl(ydl_opts: Dict[str, Any]) -> Any:
    """
    Build a YoutubeDL instance.

    yt-dlp captures the stderr stream on construction and uses it for notices we cannot
    act on (such as the Python version deprecation), so it is pointed at a throwaway
    buffer. Warnings and errors still reach the app through the configured logger.
    """
    from yt_dlp import YoutubeDL
    with discarded_stderr():
        return YoutubeDL(ydl_opts)


def resolve_downloaded_file(ydl: Any, info: Dict[str, Any]) -> str:
    """Get the path of the file yt-dlp just wrote."""
    requested = info.get("requested_downloads") or []
    if requested and requested[0].get("filepath"):
        return requested[0]["filepath"]
    return ydl.prepare_filename(info)


def download_track_audio(url: str, assets_path: str, audio_extension: str, source: str) -> Dict[str, str]:
    """Download audio with yt-dlp and convert it to the requested format."""
    source_label = SOURCE_LABELS[source]

    os.makedirs(assets_path, exist_ok=True)
    # Downloaded into its own folder so the source file can never collide with the output.
    source_path = os.path.join(assets_path, "_source")
    os.makedirs(source_path, exist_ok=True)

    ydl_opts: Dict[str, Any] = {
        "format": "bestaudio/best",
        "noplaylist": True,
        # The file is re-encoded with moviepy right after, and the fixup step would only
        # warn about the missing ffprobe binary (imageio-ffmpeg only ships ffmpeg).
        "fixup": "never",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "logger": YtDlpLogger(),
        "progress_hooks": [build_download_progress_hook(source_label)],
    }

    # moviepy ships ffmpeg through imageio-ffmpeg, so reuse it instead of requiring a system install.
    try:
        import imageio_ffmpeg
        ydl_opts["ffmpeg_location"] = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass

    try:
        with build_ydl(dict(ydl_opts, skip_download=True)) as ydl:
            probe_info = ydl.extract_info(url, download=False)

        if not probe_info:
            raise ValueError(f"Could not read the {source_label} track. Check that the link is public and correct.")
        if probe_info.get("entries") is not None:
            raise ValueError(f"{source_label} playlists are not supported. Please provide a single track URL.")

        title = sanitize_title(probe_info.get("title", ""))
        output_message(f"Track Title: {title}")

        ydl_opts["outtmpl"] = os.path.join(source_path, f"{title}.%(ext)s")
        with build_ydl(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            downloaded_file = resolve_downloaded_file(ydl, info)

        audio_out_path = convert_to_audio_format(downloaded_file, assets_path, title, audio_extension)

        return {"audio_path": audio_out_path, "assets_path": assets_path, "track_title": title}

    finally:
        shutil.rmtree(source_path, ignore_errors=True)


def download_audio(url: str, assets_path: str, audio_extension: str) -> Dict[str, str]:
    """
    Download audio from a supported platform and convert to the specified format.

    Args:
        url: YouTube or SoundCloud URL.
        assets_path: Directory to save the audio.
        audio_extension: Output format (mp3/wav).

    Returns:
        Dictionary with audio_path, assets_path and track_title.
    """
    source = detect_source(url)
    if source is None:
        raise ValueError("The URL must be a valid YouTube or SoundCloud link.")

    try:
        output_message(f"Starting audio download from {SOURCE_LABELS[source]}...")
        return download_track_audio(url, assets_path, audio_extension, source)

    except ValueError:
        raise
    except Exception as e:
        output_message(f"Error downloading audio: {str(e)}", error=True)
        raise


def create_info_file(project_path: str, key: str, bpm: int, track_title: str, source: str) -> None:
    """Create a text file with original song information."""
    try:
        info_path = os.path.join(project_path, "Original Song Info.txt")
        with open(info_path, "w", encoding="utf-8") as file:
            file.write(f"Source: {'SoundCloud' if source == 'soundcloud' else 'Youtube'}\n")
            file.write(f"Title: {track_title}\n")
            file.write("Original Song Info: \n")
            file.write(f"  -> Key: {key}\n")
            file.write(f"  -> BPM: {str(bpm)}\n")
    except Exception as err:
        output_message(f"Error creating the original song info file: {err}")


def separate_audio(assets_path: str, audio_path: str, audio_extension: str, threads: int, device: str) -> None:
    """Separate audio into stems using Demucs."""
    import demucs.separate
    import shlex

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
    import librosa
    import numpy as np
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

    source = detect_source(url)
    if source is None:
        output_message("Validation error: The URL must be a valid YouTube or SoundCloud link.", error=True)
        return 1

    device_to_use = "cpu"
    if separate_stems:
        device_to_use = check_gpu_availability()

    try:
        if os.path.exists(project_path):
            raise FileExistsError(f"The destination directory '{project_path}' already exists.")

        assets_path = os.path.join(project_path, 'assets')
        result = download_audio(url, assets_path, audio_extension)
        audio_path = result["audio_path"]
        track_title = result.get("track_title", "")

        key = detect_key(audio_path)
        bpm = get_song_bpm(audio_path)

        create_info_file(project_path, key, bpm, track_title, source)

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
    parser = argparse.ArgumentParser(description="Script to download and process YouTube/SoundCloud songs")
    parser.add_argument("project_location", help="Destination directory path")
    parser.add_argument("url", help="YouTube or SoundCloud song URL")
    parser.add_argument("project_name", help="Project name, used as the directory name")
    parser.add_argument("--separate-stems", action='store_true', help="Separate audio stems")
    parser.add_argument("--template-path", help="Path to the .flp template")
    parser.add_argument("--audio-extension", choices=['wav', 'mp3'], default='wav', help="Audio output extension")
    parser.add_argument("--threads", type=int, default=4, help="Number of threads for demucs")

    parsed_args = parser.parse_args()
    main(parsed_args)