import Swal from 'sweetalert2';

const darkThemeOptions = {
  background: '#1e1e1e',
  color: '#ffffff',
  confirmButtonColor: '#d9b063',
  cancelButtonColor: '#d33',
};

export function showError(title: string, message: string): void {
  Swal.fire({
    title,
    html: `<p>${message}</p>`,
    icon: 'error',
    ...darkThemeOptions,
  });
}

export function showSuccess(message: string): void {
  Swal.fire({
    text: message,
    icon: 'success',
    ...darkThemeOptions,
  });
}

export function validateYoutubeURL(url: string): boolean {
  if (!url) return false;
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return regExp.test(url);
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function getFileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

export function closeDialog(): void {
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) {
    (openDialog as HTMLDialogElement).close();
  }
}