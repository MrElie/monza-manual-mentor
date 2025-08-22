import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { CarBrand, CarModel } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import CarModelCard from "@/components/CarModelCard";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Car, Shield, LogOut, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut, isAdmin } = useAuth();
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
        title: t('common.error'),
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
        title: t('common.error'),
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const handleModelSelect = (model: CarModel) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/chat/${model.id}`);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: t('common.success'),
      description: 'Signed out successfully'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO Head Tags */}
      <head>
        <title>{t('app.title')} - Professional Voyah & Mhero Vehicle Repair Assistant</title>
        <meta 
          name="description" 
          content={t('app.subtitle')}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="/" />
      </head>

      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <header className="bg-[var(--automotive-gradient)] text-primary-foreground py-16 relative">
          <div className="container mx-auto px-4">
            {/* Top Navigation */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <LanguageSelector />
              </div>
              {user && (
                <div className="flex items-center gap-4">
                  <span className="text-sm opacity-90">
                    Welcome, {user.email}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/admin')}
                      className="bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="bg-transparent border-white/20 text-white hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('navigation.logout')}
                  </Button>
                </div>
              )}
            </div>

            {/* Hero Content */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <Wrench className="h-12 w-12 mr-4" />
                <h1 className="text-4xl md:text-6xl font-bold">
                  {t('app.title')}
                </h1>
              </div>
              <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
                {t('app.subtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <Badge variant="secondary" className="text-sm py-2 px-4">
                  <Shield className="h-4 w-4 mr-2" />
                  {t('home.certifiedData')}
                </Badge>
                <Badge variant="secondary" className="text-sm py-2 px-4">
                  <Car className="h-4 w-4 mr-2" />
                  {t('home.allModelsSupported')}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Brand Selection */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-foreground">
              {t('home.selectBrand')}
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
                {t('home.chooseModel', { brand: selectedBrand.display_name })}
              </h2>
              <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
                {t('home.selectModelDescription')}
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

        {/* Login CTA - Only show if not authenticated */}
        {!user && (
          <section className="py-16 bg-muted/50">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                {t('home.readyToStart')}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                {t('home.signInDescription')}
              </p>
              <Button 
                size="lg" 
                className="bg-[var(--automotive-gradient)]"
                onClick={() => navigate('/auth')}
              >
                {t('auth.signInButton')}
              </Button>
            </div>
          </section>
        )}
      </main>
    </>
  );
};

export default Index;