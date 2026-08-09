export interface Photo {
  id: string;
  title: string;
  category?: string; // Optional, as it might not be present for all photos
  url_thumb?: string;
  url_medium: string;
  url_large?: string;
  editedSrc: string; // Used in Lightbox.tsx
  dateCaptured: string; // Used in Lightbox.tsx
  iso: string | number; // Used in Lightbox.tsx
  aperture: string; // Used in Lightbox.tsx
  shutterSpeed: string; // Used in Lightbox.tsx
  width: number;
  height: number;
}