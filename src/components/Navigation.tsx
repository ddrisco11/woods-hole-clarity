import { Calendar, MapPin, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Navigation = () => {
  return (
    <nav className="bg-gradient-ocean shadow-depth border-b border-border/20">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-primary-foreground rounded-full opacity-80" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">ClearWater</h1>
              <p className="text-primary-foreground/80 text-sm">Woods Hole</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <Select defaultValue="24h">
              <SelectTrigger className="w-40 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Next 24 hours</SelectItem>
                <SelectItem value="48h">Next 48 hours</SelectItem>
                <SelectItem value="72h">Next 72 hours</SelectItem>
              </SelectContent>
            </Select>

            {/* Location Selector */}
            <Select defaultValue="woods-hole">
              <SelectTrigger className="w-48 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="woods-hole">Woods Hole</SelectItem>
                <SelectItem value="martha-vineyard">Martha's Vineyard</SelectItem>
                <SelectItem value="cape-cod-bay">Cape Cod Bay</SelectItem>
              </SelectContent>
            </Select>

            {/* Settings */}
            <Button 
              variant="ghost" 
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};