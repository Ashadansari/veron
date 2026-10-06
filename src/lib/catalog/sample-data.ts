import type { CatalogProduct } from "@/lib/catalog/types";

const kurtaImage = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85";
const sareeImage = "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=85";
const festiveImage = "https://images.unsplash.com/photo-1669197794464-7ac49a3a9820?auto=format&fit=crop&w=1200&q=85";
const coordImage = "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1200&q=85";
const fabricImage = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80";

export const sampleProducts: CatalogProduct[] = [
  {
    id: "nfs-001", slug: "meera-embroidered-kurta-set", name: "Meera embroidered kurta set", category: "Kurta sets",
    description: "A softly tailored kurta set with delicate threadwork, an easy straight silhouette, and a light cotton feel for long days and little celebrations.",
    images: [{ src: kurtaImage, alt: "Purple embroidered kurta set against a warm red backdrop" }, { src: fabricImage, alt: "Close view of embroidered fabric and fine threadwork" }],
    variants: [
      { id: "meera-s-rose", size: "S", color: "Rose", pricePaisa: "329000", originalPricePaisa: "389000", stock: 5 },
      { id: "meera-m-rose", size: "M", color: "Rose", pricePaisa: "329000", originalPricePaisa: "389000", stock: 7 },
      { id: "meera-l-rose", size: "L", color: "Rose", pricePaisa: "339000", stock: 0 },
      { id: "meera-m-olive", size: "M", color: "Olive", pricePaisa: "329000", stock: 3 },
      { id: "meera-xl-olive", size: "XL", color: "Olive", pricePaisa: "339000", stock: 2 },
    ], createdAt: 6, imageTone: "#e8e0d4",
  },
  {
    id: "nfs-002", slug: "gulabi-handwoven-saree", name: "Gulabi handwoven saree", category: "Sarees",
    description: "A rose-toned handwoven saree with a fine gold edge. Lightweight drape, considered texture, and enough detail to make an ordinary day feel special.",
    images: [{ src: sareeImage, alt: "Rose and gold handwoven saree in soft natural light" }, { src: fabricImage, alt: "Textured woven cloth in warm rose tones" }],
    variants: [
      { id: "gulabi-free-rose", size: "Free size", color: "Rose", pricePaisa: "589000", stock: 4 },
      { id: "gulabi-free-plum", size: "Free size", color: "Plum", pricePaisa: "619000", stock: 2 },
    ], createdAt: 5, imageTone: "#d9afb1",
  },
  {
    id: "nfs-003", slug: "noor-printed-anarkali", name: "Noor printed anarkali", category: "Dresses",
    description: "An easy-flowing printed anarkali with a softly gathered skirt and three-quarter sleeves. Made for movement, from brunch plans to family gatherings.",
    images: [{ src: festiveImage, alt: "Printed pink festive anarkali dress" }, { src: kurtaImage, alt: "Detail of a patterned festive outfit" }],
    variants: [
      { id: "noor-s-indigo", size: "S", color: "Indigo", pricePaisa: "419000", stock: 2 },
      { id: "noor-m-indigo", size: "M", color: "Indigo", pricePaisa: "419000", stock: 5 },
      { id: "noor-l-indigo", size: "L", color: "Indigo", pricePaisa: "439000", stock: 1 },
      { id: "noor-m-coral", size: "M", color: "Coral", pricePaisa: "419000", stock: 0 },
    ], createdAt: 4, imageTone: "#d8c9b7",
  },
  {
    id: "nfs-004", slug: "zoya-relaxed-co-ord", name: "Zoya relaxed co-ord", category: "Co-ords",
    description: "A relaxed two-piece set in breathable cotton. The boxy top and easy-fit trousers are designed to work together or find their own way into your wardrobe.",
    images: [{ src: coordImage, alt: "Neutral relaxed co-ord set" }, { src: fabricImage, alt: "Soft cotton fabric in a natural neutral shade" }],
    variants: [
      { id: "zoya-s-sand", size: "S", color: "Sand", pricePaisa: "279000", stock: 6 },
      { id: "zoya-m-sand", size: "M", color: "Sand", pricePaisa: "279000", stock: 4 },
      { id: "zoya-l-sand", size: "L", color: "Sand", pricePaisa: "289000", stock: 2 },
      { id: "zoya-m-sage", size: "M", color: "Sage", pricePaisa: "279000", stock: 0 },
    ], createdAt: 3, imageTone: "#d3c8bb",
  },
  {
    id: "nfs-005", slug: "saanvi-everyday-kurta", name: "Saanvi everyday kurta", category: "Kurta sets",
    description: "An everyday cotton kurta with a clean neckline and a little contrast detail at the cuff. Light, versatile, and easy to wear on repeat.",
    images: [{ src: fabricImage, alt: "Everyday cotton kurta in a warm neutral shade" }, { src: kurtaImage, alt: "Fine textile detail on an everyday kurta" }],
    variants: [
      { id: "saanvi-s-blue", size: "S", color: "Blue", pricePaisa: "219000", stock: 4 },
      { id: "saanvi-m-blue", size: "M", color: "Blue", pricePaisa: "219000", stock: 8 },
      { id: "saanvi-l-blue", size: "L", color: "Blue", pricePaisa: "229000", stock: 3 },
      { id: "saanvi-xl-cream", size: "XL", color: "Cream", pricePaisa: "229000", stock: 2 },
    ], createdAt: 2, imageTone: "#d8d2c5",
  },
  {
    id: "nfs-006", slug: "tara-festive-lehenga", name: "Tara festive lehenga", category: "Festive edit",
    description: "A festive set with a beautifully flared skirt, thoughtful embroidery, and a comfortable lining. A special piece for the days you want to dress up.",
    images: [{ src: festiveImage, alt: "Embroidered festive lehenga in rich pink tones" }, { src: sareeImage, alt: "Festive textile details in rose and gold" }],
    variants: [
      { id: "tara-s-wine", size: "S", color: "Wine", pricePaisa: "749000", originalPricePaisa: "829000", stock: 1 },
      { id: "tara-m-wine", size: "M", color: "Wine", pricePaisa: "749000", originalPricePaisa: "829000", stock: 2 },
      { id: "tara-l-wine", size: "L", color: "Wine", pricePaisa: "779000", stock: 0 },
    ], createdAt: 1, imageTone: "#d2a6a5",
  },
];

export const sampleCategories = [
  { name: "Kurta sets", description: "Everyday, made special" },
  { name: "Sarees", description: "Woven with a story" },
  { name: "Dresses", description: "For the days that call for more" },
  { name: "Co-ords", description: "Easy pieces, together or apart" },
  { name: "Festive edit", description: "Made for your next celebration" },
];
