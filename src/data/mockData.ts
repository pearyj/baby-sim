import type { Question } from '../types/game';

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    question: '你的孩子正在哭闹，你会怎么做？',
    options: [
      { id: 'o1', text: '立即抱起孩子安抚' },
      { id: 'o2', text: '先观察一下情况' },
      { id: 'o3', text: '让孩子自己哭一会儿' }
    ],
    isExtremeEvent: false
  },
  {
    id: 'q2',
    question: '孩子开始学走路了，你会怎么做？',
    options: [
      { id: 'o4', text: '全程扶着孩子走' },
      { id: 'o5', text: '让孩子自己尝试，在旁保护' },
      { id: 'o6', text: '使用学步车' }
    ],
    isExtremeEvent: false
  },
  {
    id: 'q3',
    question: '孩子挑食，你会怎么做？',
    options: [
      { id: 'o7', text: '强迫孩子吃完' },
      { id: 'o8', text: '尝试改变食物样式' },
      { id: 'o9', text: '让孩子自己选择' }
    ],
    isExtremeEvent: false
  }
]; 