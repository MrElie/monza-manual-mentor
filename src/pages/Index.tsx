import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Car } from "lucide-react";
import voyahFreeImg from "@/assets/voyah-free.jpg";
import voyahPassionImg from "@/assets/voyah-passion.jpg";
import voyahDreamImg from "@/assets/voyah-dream.jpg";
import voyahCourageImg from "@/assets/voyah-courage.jpg";
import mheroImg from "@/assets/mhero.jpg";

type CarBrand = {
  id: string;
  name: string;
  display_name: string;
};

type CarModel = {
  id: string;
  brand_id: string;
  name: string;
  display_name: string;
  image_url: string | null;
};

const carImages: Record<string, string> = {
  "free": voyahFreeImg,
  "passion": voyahPassionImg,
  "dream": voyahDreamImg,
  "courage": voyahCourageImg,
  "mhero-1": mheroImg,
};

const Index = () => {
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: brandsData } = await supabase
          .from("car_brands")
          .select("*")
          .order("display_name");

        const { data: modelsData } = await supabase
          .from("car_models")
          .select("*")
          .order("display_name");

        if (brandsData) setBrands(brandsData);
        if (modelsData) setModels(modelsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredModels = selectedBrand
    ? models.filter((model) => model.brand_id === selectedBrand)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <head>
        <title>Monza Repair Helper - Professional Vehicle Repair Assistant</title>
        <meta name="description" content="Professional repair assistance for Voyah and Mhero vehicles. Access comprehensive repair manuals, troubleshooting guides, and technical documentation with AI-powered chat support." />
        <meta name="keywords" content="Voyah repair, Mhero repair, vehicle repair assistant, automotive troubleshooting, repair manuals, technical documentation" />
        <link rel="canonical" href="/" />
      </head>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <header className="border-b bg-card/80 backdrop-blur-md">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wrench className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Monza Repair Helper</h1>
                  <p className="text-sm text-muted-foreground">Professional Vehicle Repair Assistant</p>
                </div>
              </div>
              <Button variant="outline" className="hidden md:flex">
                Sign In
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <section className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Select Your Vehicle
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose your vehicle brand and model to access specialized repair assistance and technical documentation.
            </p>
          </section>

          <section className="mb-8">
            <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Car className="h-6 w-6 text-primary" />
              Vehicle Brands
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {brands.map((brand) => (
                <Card 
                  key={brand.id} 
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                    selectedBrand === brand.id 
                      ? "ring-2 ring-primary bg-primary/5" 
                      : "hover:bg-card/60"
                  }`}
                  onClick={() => setSelectedBrand(brand.id)}
                >
                  <CardContent className="p-8 text-center">
                    <h4 className="text-3xl font-bold text-primary mb-2">{brand.display_name}</h4>
                    <Badge variant={selectedBrand === brand.id ? "default" : "secondary"}>
                      {models.filter(m => m.brand_id === brand.id).length} Models Available
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {selectedBrand && (
            <section className="mb-8 animate-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-2xl font-semibold mb-6">
                {brands.find(b => b.id === selectedBrand)?.display_name} Models
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredModels.map((model) => (
                  <Card 
                    key={model.id} 
                    className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 overflow-hidden"
                  >
                    <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                      <img
                        src={carImages[model.name] || "/placeholder.svg"}
                        alt={`${model.display_name} repair manual`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-6">
                      <h4 className="text-xl font-semibold mb-2">{model.display_name}</h4>
                      <p className="text-muted-foreground mb-4">
                        Access repair manuals, technical bulletins, and AI-powered troubleshooting assistance.
                      </p>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90"
                        style={{ boxShadow: "var(--automotive-shadow)" }}
                      >
                        Start Repair Session
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {!selectedBrand && (
            <section className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="p-4 bg-muted/30 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <Car className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Select a Brand</h3>
                <p className="text-muted-foreground">
                  Choose a vehicle brand above to see available models and start your repair session.
                </p>
              </div>
            </section>
          )}
        </main>

        <footer className="border-t bg-card/50 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-sm text-muted-foreground">
              <p>&copy; 2024 Monza Repair Helper. Professional automotive repair assistance.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
