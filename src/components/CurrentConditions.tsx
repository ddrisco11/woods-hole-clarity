import { TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const CurrentConditions = () => {
  return (
    <Card className="bg-gradient-surface border-accent/20 shadow-surface">
      <CardContent className="p-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Best Site Now */}
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 rounded-full bg-clarity-excellent/20 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-clarity-excellent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Best Site Now</h3>
              <p className="text-lg font-bold text-clarity-excellent">Stoney Beach</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="bg-clarity-excellent/10 text-clarity-excellent border-clarity-excellent/20">
                  Score: 82
                </Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Improving
                </div>
              </div>
            </div>
          </div>

          {/* Best Site Later */}
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 rounded-full bg-clarity-good/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-clarity-good" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Best Later Today</h3>
              <p className="text-lg font-bold text-clarity-good">Devil's Foot</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="bg-clarity-good/10 text-clarity-good border-clarity-good/20">
                  5-7 PM
                </Badge>
                <span className="text-sm text-muted-foreground">Score: 88</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Slack high tide</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 rounded-full bg-clarity-fair/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-clarity-fair" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Advisory</h3>
              <p className="text-lg font-bold text-clarity-fair">Recent Rainfall</p>
              <p className="text-sm text-muted-foreground mt-1">
                Rain in past 12h — clarity depressed in Great Harbor
              </p>
              <Badge variant="outline" className="mt-2 border-clarity-fair/30 text-clarity-fair">
                Moderate Impact
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};