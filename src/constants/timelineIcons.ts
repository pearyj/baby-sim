import {
  // Baby & Toddler (0-3)
  ChildCare,
  Toys,
  DirectionsRun,
  
  // Early Childhood (4-7)  
  School,
  MenuBook,
  ColorLens,
  SportsEsports,
  
  // Middle Childhood (8-11)
  SportsBasketball,
  SportsVolleyball,
  Science,
  LibraryBooks,
  MusicNote,
  Palette,
  
  // Early Teens (12-14)
  Smartphone,
  Headphones,
  Camera,
  Brush,
  SportsFootball,
  TheaterComedy,
  
  // Mid Teens (15-16)
  DirectionsCar,
  PhotoCamera,
  Piano,
  FitnessCenter,
  Psychology,
  
  // Late Teens (17-18)
  EmojiEvents,
  
  // Additional Icons
  Face,
  SentimentSatisfied,
  Favorite,
  LocalFlorist,
  Build,
  Computer,
  SportsHandball,
  AutoStories,
  Calculate,
  Language,
  Man,
  Woman
} from '@mui/icons-material';

export interface TimelineIconConfig {
  icon: React.ComponentType;
  color: string;
  description: string;
}

export interface GenderIconMap {
  male: TimelineIconConfig;
  female: TimelineIconConfig;
}

/**
 * Comprehensive timeline icon mapping for ages 0-18
 * Organized by developmental stages with gender-specific representations
 */
export const TIMELINE_ICONS: Record<number, GenderIconMap> = {
  // === INFANCY & TODDLERHOOD (0-3) ===
  0: {
    male: { 
      icon: ChildCare, 
      color: '#4CAF50', 
      description: '新生男婴' 
    },
    female: { 
      icon: ChildCare, 
      color: '#E91E63', 
      description: '新生女婴' 
    }
  },
  
  1: {
    male: { 
      icon: Face, 
      color: '#4CAF50', 
      description: '微笑男婴' 
    },
    female: { 
      icon: SentimentSatisfied, 
      color: '#E91E63', 
      description: '开心女婴' 
    }
  },
  
  2: {
    male: { 
      icon: Toys, 
      color: '#2196F3', 
      description: '好动男童' 
    },
    female: { 
      icon: LocalFlorist, 
      color: '#E91E63', 
      description: '可爱女童' 
    }
  },
  
  3: {
    male: { 
      icon: DirectionsRun, 
      color: '#2196F3', 
      description: '活泼男童' 
    },
    female: { 
      icon: Favorite, 
      color: '#E91E63', 
      description: '甜美女童' 
    }
  },
  
  // === EARLY CHILDHOOD (4-7) ===
  4: {
    male: { 
      icon: SportsEsports, 
      color: '#2196F3', 
      description: '游戏男孩' 
    },
    female: { 
      icon: ColorLens, 
      color: '#9C27B0', 
      description: '艺术女孩' 
    }
  },
  
  5: {
    male: { 
      icon: Build, 
      color: '#FF9800', 
      description: '建造男孩' 
    },
    female: { 
      icon: Palette, 
      color: '#9C27B0', 
      description: '创意女孩' 
    }
  },
  
  6: {
    male: { 
      icon: School, 
      color: '#2196F3', 
      description: '入学男孩' 
    },
    female: { 
      icon: MenuBook, 
      color: '#9C27B0', 
      description: '学习女孩' 
    }
  },
  
  7: {
    male: { 
      icon: LibraryBooks, 
      color: '#2196F3', 
      description: '求知男孩' 
    },
    female: { 
      icon: AutoStories, 
      color: '#9C27B0', 
      description: '读书女孩' 
    }
  },
  
  // === MIDDLE CHILDHOOD (8-11) ===
  8: {
    male: { 
      icon: SportsBasketball, 
      color: '#FF9800', 
      description: '运动男孩' 
    },
    female: { 
      icon: MusicNote, 
      color: '#9C27B0', 
      description: '音乐女孩' 
    }
  },
  
  9: {
    male: { 
      icon: Science, 
      color: '#4CAF50', 
      description: '科学男孩' 
    },
    female: { 
      icon: Calculate, 
      color: '#9C27B0', 
      description: '学习女孩' 
    }
  },
  
  10: {
    male: { 
      icon: Computer, 
      color: '#2196F3', 
      description: '科技男孩' 
    },
    female: { 
      icon: SportsVolleyball, 
      color: '#E91E63', 
      description: '运动女孩' 
    }
  },
  
  11: {
    male: { 
      icon: SportsHandball, 
      color: '#FF9800', 
      description: '活跃男孩' 
    },
    female: { 
      icon: TheaterComedy, 
      color: '#9C27B0', 
      description: '表演女孩' 
    }
  },
  
  // === EARLY TEENS (12-14) ===
  12: {
    male: { 
      icon: SportsFootball, 
      color: '#FF5722', 
      description: '运动少年' 
    },
    female: { 
      icon: Camera, 
      color: '#E91E63', 
      description: '摄影少女' 
    }
  },
  
  13: {
    male: { 
      icon: Smartphone, 
      color: '#607D8B', 
      description: '科技少年' 
    },
    female: { 
      icon: Brush, 
      color: '#9C27B0', 
      description: '艺术少女' 
    }
  },
  
  14: {
    male: { 
      icon: Headphones, 
      color: '#795548', 
      description: '音乐少年' 
    },
    female: { 
      icon: Language, 
      color: '#673AB7', 
      description: '语言少女' 
    }
  },
  
  // === MID TEENS (15-16) ===
  15: {
    male: { 
      icon: FitnessCenter, 
      color: '#FF5722', 
      description: '健身少年' 
    },
    female: { 
      icon: Piano, 
      color: '#673AB7', 
      description: '音乐少女' 
    }
  },
  
  16: {
    male: { 
      icon: DirectionsCar, 
      color: '#424242', 
      description: '驾驶少年' 
    },
    female: { 
      icon: PhotoCamera, 
      color: '#E91E63', 
      description: '摄影少女' 
    }
  },
  
  // === LATE TEENS (17-18) ===
  17: {
    male: { 
      icon: Psychology, 
      color: '#795548', 
      description: '思考少年' 
    },
    female: { 
      icon: EmojiEvents, 
      color: '#FF9800', 
      description: '成就少女' 
    }
  },
  
  18: {
    male: { 
      icon: Man, 
      color: '#424242', 
      description: '成年男性' 
    },
    female: { 
      icon: Woman, 
      color: '#673AB7', 
      description: '成年女性' 
    }
  }
};

/**
 * Get timeline icon configuration for specific age and gender
 */
export const getTimelineIcon = (age: number, gender: 'male' | 'female'): TimelineIconConfig => {
  const ageConfig = TIMELINE_ICONS[age];
  
  if (!ageConfig) {
    // Fallback for ages outside 0-18 range
    if (age < 0) {
      return {
        icon: ChildCare,
        color: gender === 'male' ? '#4CAF50' : '#E91E63',
        description: gender === 'male' ? '男婴' : '女婴'
      };
    } else {
      return {
        icon: gender === 'male' ? Man : Woman,
        color: gender === 'male' ? '#424242' : '#673AB7',
        description: gender === 'male' ? '成年男性' : '成年女性'
      };
    }
  }
  
  return ageConfig[gender];
};

/**
 * Get the primary color for current age highlighting
 */
export const getCurrentAgeColor = (): string => '#6750A4';

/**
 * Age-based developmental stage labels
 */
export const DEVELOPMENTAL_STAGES = {
  0: '新生儿期',
  1: '婴儿期', 
  2: '学步期',
  3: '学前期',
  4: '学前期',
  5: '学前期',
  6: '学龄期',
  7: '学龄期',
  8: '学龄期',
  9: '学龄期',
  10: '学龄期',
  11: '学龄期',
  12: '青春期',
  13: '青春期',
  14: '青春期',
  15: '青春期',
  16: '青春期',
  17: '青春期',
  18: '成年期'
} as const; 