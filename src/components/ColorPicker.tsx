import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

const ColorPicker = () => {
  const [primaryHue, setPrimaryHue] = useState(210);
  const [backgroundHue, setBackgroundHue] = useState(0);
  const [backgroundSaturation, setBackgroundSaturation] = useState(0);
  const [backgroundLightness, setBackgroundLightness] = useState(100);

  // Load saved colors from localStorage on mount
  useEffect(() => {
    const savedPrimaryHue = localStorage.getItem('theme-primary-hue');
    const savedBgHue = localStorage.getItem('theme-bg-hue');
    const savedBgSat = localStorage.getItem('theme-bg-saturation');
    const savedBgLight = localStorage.getItem('theme-bg-lightness');

    if (savedPrimaryHue) setPrimaryHue(Number(savedPrimaryHue));
    if (savedBgHue) setBackgroundHue(Number(savedBgHue));
    if (savedBgSat) setBackgroundSaturation(Number(savedBgSat));
    if (savedBgLight) setBackgroundLightness(Number(savedBgLight));
  }, []);

  // Update CSS custom properties and save to localStorage
  useEffect(() => {
    const root = document.documentElement;
    
    // Update primary colors (buttons, accents)
    root.style.setProperty('--primary', `${primaryHue} 100% 15%`);
    root.style.setProperty('--primary-foreground', `${primaryHue} 40% 98%`);
    root.style.setProperty('--accent', `${primaryHue} 100% 25%`);
    root.style.setProperty('--accent-foreground', `${primaryHue} 40% 98%`);
    
    // Update background colors
    root.style.setProperty('--background', `${backgroundHue} ${backgroundSaturation}% ${backgroundLightness}%`);
    root.style.setProperty('--card', `${backgroundHue} ${backgroundSaturation}% ${Math.min(backgroundLightness + 2, 100)}%`);
    root.style.setProperty('--popover', `${backgroundHue} ${backgroundSaturation}% ${Math.min(backgroundLightness + 1, 100)}%`);
    
    // Adjust muted colors based on background
    const mutedLightness = backgroundLightness > 50 ? backgroundLightness - 5 : backgroundLightness + 10;
    root.style.setProperty('--muted', `${backgroundHue} ${Math.min(backgroundSaturation + 10, 40)}% ${mutedLightness}%`);
    
    // Update gradients
    root.style.setProperty('--automotive-gradient', `linear-gradient(135deg, hsl(${primaryHue} 100% 15%), hsl(${primaryHue} 100% 25%))`);
    
    // Save to localStorage
    localStorage.setItem('theme-primary-hue', primaryHue.toString());
    localStorage.setItem('theme-bg-hue', backgroundHue.toString());
    localStorage.setItem('theme-bg-saturation', backgroundSaturation.toString());
    localStorage.setItem('theme-bg-lightness', backgroundLightness.toString());
  }, [primaryHue, backgroundHue, backgroundSaturation, backgroundLightness]);

  const resetToDefault = () => {
    setPrimaryHue(210);
    setBackgroundHue(0);
    setBackgroundSaturation(0);
    setBackgroundLightness(100);
    
    // Clear localStorage
    localStorage.removeItem('theme-primary-hue');
    localStorage.removeItem('theme-bg-hue');
    localStorage.removeItem('theme-bg-saturation');
    localStorage.removeItem('theme-bg-lightness');
  };

  const presetColors = [
    { name: 'Ocean Blue', primaryHue: 210, bgHue: 210, bgSat: 15, bgLight: 98 },
    { name: 'Forest Green', primaryHue: 120, bgHue: 120, bgSat: 10, bgLight: 97 },
    { name: 'Sunset Orange', primaryHue: 30, bgHue: 30, bgSat: 20, bgLight: 96 },
    { name: 'Royal Purple', primaryHue: 280, bgHue: 280, bgSat: 12, bgLight: 97 },
    { name: 'Rose Gold', primaryHue: 15, bgHue: 15, bgSat: 25, bgLight: 95 },
    { name: 'Midnight', primaryHue: 240, bgHue: 240, bgSat: 30, bgLight: 8 },
  ];

  const applyPreset = (preset: typeof presetColors[0]) => {
    setPrimaryHue(preset.primaryHue);
    setBackgroundHue(preset.bgHue);
    setBackgroundSaturation(preset.bgSat);
    setBackgroundLightness(preset.bgLight);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Colors</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border shadow-lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Customize Colors</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primary-hue">Primary Color (Buttons & Accents)</Label>
            <div className="flex items-center gap-2">
              <input
                id="primary-hue"
                type="range"
                min="0"
                max="360"
                value={primaryHue}
                onChange={(e) => setPrimaryHue(Number(e.target.value))}
                className="flex-1 h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), 
                    hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`
                }}
              />
              <div 
                className="w-8 h-8 rounded-full border-2 border-gray-300"
                style={{ backgroundColor: `hsl(${primaryHue}, 100%, 50%)` }}
              />
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label htmlFor="bg-hue">Background Hue</Label>
            <div className="flex items-center gap-2">
              <input
                id="bg-hue"
                type="range"
                min="0"
                max="360"
                value={backgroundHue}
                onChange={(e) => setBackgroundHue(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-12">{backgroundHue}°</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bg-saturation">Background Saturation</Label>
            <div className="flex items-center gap-2">
              <input
                id="bg-saturation"
                type="range"
                min="0"
                max="50"
                value={backgroundSaturation}
                onChange={(e) => setBackgroundSaturation(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-12">{backgroundSaturation}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bg-lightness">Background Lightness</Label>
            <div className="flex items-center gap-2">
              <input
                id="bg-lightness"
                type="range"
                min="5"
                max="100"
                value={backgroundLightness}
                onChange={(e) => setBackgroundLightness(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-12">{backgroundLightness}%</span>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="grid grid-cols-2 gap-2">
              <div 
                className="h-12 rounded border flex items-center justify-center text-sm"
                style={{ 
                  backgroundColor: `hsl(${backgroundHue}, ${backgroundSaturation}%, ${backgroundLightness}%)`,
                  color: backgroundLightness > 50 ? '#000' : '#fff'
                }}
              >
                Background
              </div>
              <div 
                className="h-12 rounded border flex items-center justify-center text-sm text-white"
                style={{ backgroundColor: `hsl(${primaryHue}, 100%, 15%)` }}
              >
                Primary
              </div>
            </div>
          </div>

          {/* Preset Colors */}
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="grid grid-cols-2 gap-1">
              {presetColors.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="text-xs h-8"
                  style={{
                    backgroundColor: `hsl(${preset.bgHue}, ${preset.bgSat}%, ${preset.bgLight}%)`,
                    borderColor: `hsl(${preset.primaryHue}, 100%, 15%)`,
                    color: preset.bgLight > 50 ? '#000' : '#fff'
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;