import { ImageGallery, type GalleryImage } from "@/components/ui/image-gallery";
const images: GalleryImage[] = [];
export default function DemoOne() {
  return <ImageGallery images={images} />;
}