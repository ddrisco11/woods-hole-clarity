import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wind, Waves, CloudRain, Compass } from "lucide-react";

export const DataPanel = () => {
  return (
    <div className="space-y-6">
      {/* Wind Conditions */}
      <Card className="shadow-surface">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wind className="w-5 h-5 text-primary" />
            <span>Wind Conditions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3 bg-gradient-surface rounded-full flex items-center justify-center">
                <Compass className="w-8 h-8 text-primary transform rotate-45" />
                <div className="absolute top-1 text-xs font-bold text-primary">NE</div>
              </div>
              <p className="text-sm text-muted-foreground">Direction</p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-bold">12 kts</p>
                <p className="text-sm text-muted-foreground">Current Speed</p>
              </div>
              <div>
                <p className="text-lg">15-18 kts</p>
                <p className="text-xs text-muted-foreground">Next 6 hours</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tide Information */}
      <Card className="shadow-surface">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Waves className="w-5 h-5 text-primary" />
            <span>Tide Conditions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current</span>
              <span className="font-semibold">Rising (+2.1 ft)</span>
            </div>
            <div className="relative h-8 bg-muted rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-ocean transition-all duration-500"
                style={{ width: '65%' }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                High Tide: 3:42 PM
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Next Low</p>
                <p className="font-semibold">9:18 PM (-1.2 ft)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Next High</p>
                <p className="font-semibold">3:42 AM (+3.8 ft)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rainfall */}
      <Card className="shadow-surface">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CloudRain className="w-5 h-5 text-primary" />
            <span>Rainfall (72h)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">0.8 inches</span>
            </div>
            <div className="grid grid-cols-8 gap-1 h-16">
              {[0.1, 0.3, 0.2, 0.0, 0.0, 0.2, 0.0, 0.0].map((rain, i) => (
                <div key={i} className="bg-muted rounded-t-sm relative">
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm transition-all"
                    style={{ height: `${(rain / 0.3) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};