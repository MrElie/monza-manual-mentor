import { CarModel } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

// Import car images
import voyahFreeImage from "@/assets/voyah-free.jpg";
import voyahPassionImage from "@/assets/voyah-passion.jpg";
import voyahDreamImage from "@/assets/voyah-dream.jpg";
import voyahCourageImage from "@/assets/voyah-courage.jpg";
import mheroImage from "@/assets/mhero.jpg";

interface CarModelCardProps {
  model: CarModel;
  onSelect: (model: CarModel) => void;
}

const CarModelCard = ({ model, onSelect }: CarModelCardProps) => {
  // Map car model names to imported images
  const getCarImage = (modelName: string) => {
    switch (modelName) {
      case 'free':
        return voyahFreeImage;
      case 'passion':
        return voyahPassionImage;
      case 'dream':
        return voyahDreamImage;
      case 'courage':
        return voyahCourageImage;
      case 'mhero-1':
        return mheroImage;
      default:
        return voyahFreeImage; // fallback
    }
  };

  const imageUrl = model.image_url || getCarImage(model.name);

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-[var(--automotive-shadow)] hover:scale-105 border-border bg-card">
      <div className="aspect-video overflow-hidden">
        <img
          src={imageUrl}
          alt={`${model.display_name} - Electric luxury vehicle`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
      </div>
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-3 text-foreground">
          {model.display_name}
        </h3>
        <Button
          onClick={() => onSelect(model)}
          className="w-full bg-[var(--automotive-gradient)] hover:shadow-[var(--automotive-glow)] transition-all duration-300"
          size="lg"
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Start Repair Chat
        </Button>
      </CardContent>
    </Card>
  );
};

export default CarModelCard;