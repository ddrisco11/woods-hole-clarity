import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Waves, Eye } from "lucide-react";
import { mockClaritySites } from "@/lib/mockData";

export const ClarityMap = () => {
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const getClarityColor = (score: number) => {
    if (score >= 80) return "bg-clarity-excellent";
    if (score >= 65) return "bg-clarity-good";
    if (score >= 45) return "bg-clarity-fair";
    if (score >= 25) return "bg-clarity-poor";
    return "bg-clarity-very-poor";
  };

  const getClarityLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 45) return "Fair";
    if (score >= 25) return "Poor";
    return "Very Poor";
  };

  return (
    <div className="space-y-6">
      {/* Interactive Map */}
      <Card className="shadow-depth">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5 text-primary" />
            <span>Woods Hole Clarity Map</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Map Container */}
          <div className="relative bg-gradient-depth rounded-lg h-80 overflow-hidden">
            {/* Simulated map background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/30" />
            
            {/* Site markers */}
            <div className="absolute inset-0">
              {mockClaritySites.map((site) => (
                <div
                  key={site.id}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group"
                  style={{ 
                    left: `${site.position.x}%`, 
                    top: `${site.position.y}%` 
                  }}
                  onClick={() => setSelectedSite(selectedSite === site.id ? null : site.id)}
                >
                  <div className={`
                    w-4 h-4 rounded-full ${getClarityColor(site.clarityScore)}
                    shadow-lg border-2 border-white
                    transition-all duration-300 group-hover:scale-150 group-hover:shadow-glow
                    ${selectedSite === site.id ? 'scale-150 shadow-glow' : ''}
                  `} />
                  
                  {/* Site label */}
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card p-2 rounded-md shadow-lg text-xs whitespace-nowrap z-10">
                    <div className="font-semibold">{site.name}</div>
                    <div className="text-muted-foreground">Score: {site.clarityScore}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
              <h4 className="text-xs font-semibold mb-2">Clarity Scale</h4>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-clarity-excellent" />
                  <span>Excellent (80+)</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-clarity-good" />
                  <span>Good (65-79)</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-clarity-fair" />
                  <span>Fair (45-64)</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-clarity-poor" />
                  <span>Poor (25-44)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Rankings */}
      <Card className="shadow-surface">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Site Rankings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockClaritySites
              .sort((a, b) => b.clarityScore - a.clarityScore)
              .map((site, index) => (
                <div
                  key={site.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border transition-colors
                    ${selectedSite === site.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
                    cursor-pointer
                  `}
                  onClick={() => setSelectedSite(selectedSite === site.id ? null : site.id)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div className={`w-3 h-3 rounded-full ${getClarityColor(site.clarityScore)}`} />
                    <div>
                      <h4 className="font-semibold">{site.name}</h4>
                      <p className="text-sm text-muted-foreground">{site.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="secondary"
                      className={`
                        ${site.clarityScore >= 80 ? 'bg-clarity-excellent/10 text-clarity-excellent border-clarity-excellent/20' : ''}
                        ${site.clarityScore >= 65 && site.clarityScore < 80 ? 'bg-clarity-good/10 text-clarity-good border-clarity-good/20' : ''}
                        ${site.clarityScore >= 45 && site.clarityScore < 65 ? 'bg-clarity-fair/10 text-clarity-fair border-clarity-fair/20' : ''}
                        ${site.clarityScore < 45 ? 'bg-clarity-poor/10 text-clarity-poor border-clarity-poor/20' : ''}
                      `}
                    >
                      {site.clarityScore}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getClarityLabel(site.clarityScore)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};