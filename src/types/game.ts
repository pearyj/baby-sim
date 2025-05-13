export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id?: string;
  question: string;
  options: Option[];
  isExtremeEvent: boolean;
}

export interface GameState {
  player: {
    gender: 'male' | 'female';
    age: number;
    [key: string]: any;
  };
  child: {
    name: string;
    gender: 'male' | 'female';
    age: number;
    [key: string]: any;
  };
  history: {
    age: number;
    question: string;
    choice: string;
    outcome: string;
  }[];
  playerDescription: string;
  childDescription: string;
}

//   
