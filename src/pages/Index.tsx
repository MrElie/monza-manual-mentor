import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CarBrand, CarModel } from "@/types/database";
import CarModelCard from "@/components/CarModelCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Car, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<CarBrand | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      fetchModels(selectedBrand.id);
    }
  }, [selectedBrand]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('car_brands')
        .select('*')
        .order('display_name');

      if (error) throw error;
      setBrands(data || []);
      if (data && data.length > 0) {
        setSelectedBrand(data[0]); // Auto-select first brand
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast({
        title: "Error loading brands",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('*, brand:car_brands(*)')
        .eq('brand_id', brandId)
        .order('display_name');

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        title: "Error loading models",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const handleModelSelect = (model: CarModel) => {
    // TODO: Navigate to chat interface with selected model
    toast({
      title: "Chat Feature Coming Soon",
      description: `Selected ${model.display_name}. Chat interface will be available soon.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading repair assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO Head Tags */}
      <head>
        <title>Monza Repair Helper - Professional Voyah & Mhero Vehicle Repair Assistant</title>
        <meta 
          name="description" 
          content="Professional repair assistant for Voyah and Mhero electric vehicles. Access technical manuals, diagnostics, and repair guidance from certified experts." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="/" />
      </head>

      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <header className="bg-[var(--automotive-gradient)] text-primary-foreground py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center mb-6">
              <Wrench className="h-12 w-12 mr-4" />
              <h1 className="text-4xl md:text-6xl font-bold">
                Monza Repair Helper
              </h1>
            </div>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              Professional repair assistant for Voyah and Mhero electric vehicles
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Badge variant="secondary" className="text-sm py-2 px-4">
                <Shield className="h-4 w-4 mr-2" />
                Certified Technical Data
              </Badge>
              <Badge variant="secondary" className="text-sm py-2 px-4">
                <Car className="h-4 w-4 mr-2" />
                All Models Supported
              </Badge>
            </div>
          </div>
        </header>

        {/* Brand Selection */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-foreground">
              Select Vehicle Brand
            </h2>
            <div className="flex justify-center gap-4 mb-8">
              {brands.map((brand) => (
                <Button
                  key={brand.id}
                  onClick={() => setSelectedBrand(brand)}
                  variant={selectedBrand?.id === brand.id ? "default" : "outline"}
                  size="lg"
                  className="min-w-32"
                >
                  {brand.display_name}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Model Selection */}
        {selectedBrand && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-4 text-foreground">
                Choose Your {selectedBrand.display_name} Model
              </h2>
              <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                Select your specific vehicle model to access targeted repair guides, 
                technical manuals, and expert assistance.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {models.map((model) => (
                  <CarModelCard
                    key={model.id}
                    model={model}
                    onSelect={handleModelSelect}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Login CTA */}
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Sign in to access the full repair assistant with personalized chat history 
              and advanced diagnostic tools.
            </p>
            <Button size="lg" className="bg-[var(--automotive-gradient)]">
              Sign In to Continue
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default Index;