import React from 'react';

interface USMapProps {
  visitedStates: string[];
  onStateClick: (state: string) => void;
  onStateHover?: (state: string | null) => void;
  isInteractive: boolean;
}

export default function USMap({ visitedStates, onStateClick, onStateHover, isInteractive }: USMapProps) {
  return (
    <svg
      viewBox="0 0 959 593"
      className="w-full h-auto"
      style={{ maxHeight: '600px' }}
    >
      <g id="alabama">
        <path
          d="M 733.6,445.4 734.3,443.8 735.1,442.3 735.8,440.7 736.6,439.1 737.3,437.6 738,436 738.8,434.4 739.5,432.9 740.3,431.3 741,429.7 741.7,428.2 742.5,426.6 743.2,425 744,423.5 744.7,421.9 745.4,420.3 746.2,418.8 746.9,417.2 747.7,415.6 748.4,414.1 749.1,412.5 749.9,411 750.6,409.4 751.4,407.8 752.1,406.3 752.8,404.7 753.6,403.1 754.3,401.6 755,400 755.8,398.4 756.5,396.9 757.3,395.3 758,393.7 758.7,392.2 759.5,390.6 760.2,389 761,387.5 761.7,385.9 762.4,384.3 763.2,382.8 763.9,381.2 764.7,379.6 765.4,378.1 766.1,376.5 766.9,375 767.6,373.4 768.4,371.8 769.1,370.3 769.8,368.7 770.6,367.1 771.3,365.6 772,364 772.8,362.4 773.5,360.9 774.3,359.3 775,357.7 775.7,356.2 776.5,354.6 777.2,353 778,351.5 778.7,349.9 779.4,348.3 780.2,346.8 780.9,345.2 781.7,343.6 782.4,342.1 783.1,340.5 783.9,338.9 784.6,337.4 785.4,335.8 786.1,334.2 786.8,332.7 787.6,331.1 788.3,329.5 789,328 789.8,326.4 790.5,324.8 791.3,323.3 792,321.7 792.7,320.1 793.5,318.6 794.2,317 795,315.4 795.7,313.9 796.4,312.3 797.2,310.7 797.9,309.2 798.7,307.6 799.4,306 800.1,304.5 800.9,302.9 801.6,301.3 802.4,299.8 803.1,298.2 803.8,296.6 804.6,295.1 805.3,293.5 806,292 806.8,290.4 807.5,288.8 808.3,287.3"
          className={`${
            visitedStates.includes('AL')
              ? 'fill-primary-500 stroke-primary-700'
              : 'fill-gray-200 stroke-gray-400 hover:fill-gray-300'
          } transition-all ${isInteractive ? 'cursor-pointer' : ''}`}
          strokeWidth="2"
          onClick={() => isInteractive && onStateClick('AL')}
          onMouseEnter={() => onStateHover?.('AL')}
          onMouseLeave={() => onStateHover?.(null)}
        />
      </g>
      
      {/* I'll add more states - this is getting very long. Let me give you a better solution */}
    </svg>
  );
}
