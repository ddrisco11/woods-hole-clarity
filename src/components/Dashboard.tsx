import { Navigation } from "./Navigation";
import { ClarityMap } from "./ClarityMap";
import { CurrentConditions } from "./CurrentConditions";
import { DataPanel } from "./DataPanel";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto p-6 space-y-6">
        {/* Current Conditions Summary */}
        <CurrentConditions />
        
        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-2 gap-6 min-h-[600px]">
          {/* Left Panel - Data Inputs & Conditions */}
          <DataPanel />
          
          {/* Right Panel - Clarity Map & Rankings */}
          <div className="space-y-6">
            <ClarityMap />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;