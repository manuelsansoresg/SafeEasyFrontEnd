export function validateAdImages(desktop: File | null, mobile: File | null): string | null {
  for (const file of [desktop, mobile]) {
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name))) {
      return "Utiliza imágenes JPEG, PNG o WebP.";
    }
  }
  return null;
}
