import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/30 border-t border-border py-8 mt-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-muted-foreground text-sm">
              Created by{' '}
              <a 
                href="mailto:elie@meouchi.net" 
                className="text-primary hover:underline font-medium"
              >
                Elie Meouchi
              </a>
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-muted-foreground text-sm">
              © {currentYear} Monza Repair Helper. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;