import type { Question, GameState } from '../types/game';

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    question: '你的孩子正在哭闹，你会怎么做？',
    options: [
      { id: 'o1', text: '立即抱起孩子安抚', cost: 0 },
      { id: 'o2', text: '先观察一下情况', cost: 0 },
      { id: 'o3', text: '让孩子自己哭一会儿', cost: 0 }
    ],
    isExtremeEvent: false
  },
  {
    id: 'q2',
    question: '孩子开始学走路了，你会怎么做？',
    options: [
      { id: 'o4', text: '全程扶着孩子走', cost: 0 },
      { id: 'o5', text: '让孩子自己尝试，在旁保护', cost: 0 },
      { id: 'o6', text: '使用学步车', cost: 100 }
    ],
    isExtremeEvent: false
  },
  {
    id: 'q3',
    question: '孩子挑食，你会怎么做？',
    options: [
      { id: 'o7', text: '强迫孩子吃完', cost: 0 },
      { id: 'o8', text: '尝试改变食物样式', cost: 50 },
      { id: 'o9', text: '让孩子自己选择', cost: 0 }
    ],
    isExtremeEvent: false
  }
];

// English dummy data for testing
export const mockGameStateEnglish: GameState = {
  player: {
    gender: 'female' as const,
    age: 28,
  },
  child: {
    name: 'Emily',
    gender: 'female' as const,
    age: 18,
  },
  history: [
    {
      age: 2,
      question: 'Your child is having frequent tantrums. How do you handle this challenging behavior?',
      choice: 'Set consistent boundaries with patience and understanding',
      outcome: 'Emily learned to express her emotions better through your patient guidance, building trust between you.',
    },
    {
      age: 5,
      question: 'Emily shows exceptional artistic talent but struggles with math. How do you support her education?',
      choice: 'Encourage her artistic abilities while providing extra math support',
      outcome: 'Emily flourished in art while gaining confidence in math through your balanced approach.',
    },
    {
      age: 8,
      question: 'Emily comes home upset because other kids teased her about her drawings. How do you respond?',
      choice: 'Help her understand that uniqueness is a strength and teach resilience',
      outcome: 'Emily developed strong self-confidence and learned to value her unique perspective.',
    },
    {
      age: 12,
      question: 'Emily wants to quit art classes to fit in with her peers. What is your response?',
      choice: 'Support her choice while keeping art opportunities available at home',
      outcome: 'Emily appreciated your understanding and eventually returned to art with renewed passion.',
    },
    {
      age: 15,
      question: 'Emily is accepted into a prestigious art program but it means moving away from home. How do you handle this?',
      choice: 'Support her dreams while ensuring she has strong emotional support systems',
      outcome: 'Emily thrived in the program and maintained a close relationship with you through regular communication.',
    },
  ],
  playerDescription: 'As a single mother working as a nurse, you balanced demanding work schedules with devoted parenting. Your patience, creativity, and unwavering support helped shape Emily into a confident young artist. Despite financial challenges, you prioritized her emotional well-being and creative development.',
  childDescription: 'Emily grew up to be a talented, confident young woman with a strong sense of self. Her artistic abilities flourished under your guidance, and she developed resilience, empathy, and independence. She maintains a close relationship with you while pursuing her dreams in the art world.',
  finance: 6,
  marital: 3,
  isSingleParent: true,
  pendingChoice: null,
  currentQuestion: null,
  feedbackText: null,
  endingSummaryText: `# Emily's Journey to Adulthood

Your parenting journey with Emily has been a beautiful testament to the power of patience, understanding, and unconditional support. Through eighteen years of challenges and triumphs, you've raised a remarkable young woman.

## The Foundation Years (Ages 0-5)
During Emily's early years, you established a foundation of trust and security. When she struggled with tantrums, your patient approach taught her emotional regulation. Your recognition and nurturing of her artistic talents during these formative years set the stage for her future success.

## Building Character (Ages 6-10)
The elementary school years brought new challenges, especially when Emily faced teasing about her unique artistic style. Your wisdom in teaching her that uniqueness is a strength helped her develop unshakeable self-confidence. You balanced encouraging her gifts while ensuring she developed well-rounded skills.

## Navigating Adolescence (Ages 11-15)
The teenage years tested both of you. When peer pressure threatened to derail Emily's artistic passion, your supportive yet non-pressuring approach allowed her to find her own way back to her true calling. You respected her autonomy while keeping doors open.

## Launching into Independence (Ages 16-18)
As Emily prepared for adulthood, your support of her acceptance into the prestigious art program showed your ultimate goal: raising an independent, confident individual. Despite the difficulty of separation, you prioritized her dreams over your own comfort.

## Your Legacy
Emily has grown into a talented artist with strong emotional intelligence, resilience, and a deep capacity for empathy. Your single-parent journey, while challenging, has created an unbreakable bond between you. She carries forward the values you instilled: creativity, persistence, kindness, and the courage to be authentically herself.

The young woman leaving home today is a reflection of your dedicated parenting—confident in her abilities, secure in your love, and ready to make her mark on the world through her art.

<!-- story_style: Warm watercolor illustration -->`
};

// Chinese dummy data for testing  
export const mockGameStateChinese: GameState = {
  player: {
    gender: 'male' as const,
    age: 32,
  },
  child: {
    name: '小明',
    gender: 'male' as const,
    age: 18,
  },
  history: [
    {
      age: 3,
      question: '孩子在幼儿园总是不愿意分享玩具，你会如何引导？',
      choice: '通过故事和游戏教导分享的快乐',
      outcome: '小明逐渐理解了分享的意义，在幼儿园交到了很多好朋友。',
    },
    {
      age: 6,
      question: '小明对学习不感兴趣，更喜欢踢足球，你的态度是？',
      choice: '平衡学习和兴趣，让他在运动中也能学到知识',
      outcome: '小明学会了时间管理，学习成绩提高的同时足球技能也在进步。',
    },
    {
      age: 10,
      question: '小明在学校被同学欺负，回家哭着告诉你，你会怎么做？',
      choice: '教他如何自信地表达自己，同时联系老师寻求帮助',
      outcome: '小明学会了保护自己，也明白了寻求帮助不是懦弱的表现。',
    },
    {
      age: 14,
      question: '青春期的小明开始叛逆，不愿意和你交流，你如何应对？',
      choice: '给他空间的同时，寻找合适的时机进行深入沟通',
      outcome: '通过耐心和理解，你们的关系变得更加坚固，小明也学会了承担责任。',
    },
    {
      age: 17,
      question: '小明想要报考体育专业，但你担心就业前景，如何决定？',
      choice: '支持他的梦想，同时帮助他制定完整的职业规划',
      outcome: '小明在追求梦想的路上更加努力，也为未来做好了充分的准备。',
    },
  ],
  playerDescription: '作为一名工程师父亲，你在繁忙的工作中始终不忘陪伴孩子成长。你用理性和感性并重的方式教育小明，既关注他的学业发展，也尊重他的兴趣爱好。在妻子的支持下，你们共同为小明创造了温暖而充满爱的家庭环境。',
  childDescription: '小明成长为一个阳光、自信、有责任心的年轻人。他不仅在学业上表现优秀，在足球方面也很有天赋。更重要的是，他学会了如何处理人际关系，懂得感恩，对未来充满憧憬和规划。',
  finance: 8,
  marital: 9,
  isSingleParent: false,
  pendingChoice: null,
  currentQuestion: null,
  feedbackText: null,
  endingSummaryText: `# 小明的成长之路

十八年的育儿旅程即将告一段落，看着小明从一个不愿分享的小男孩成长为今天这样优秀的青年，作为父亲的你内心充满了骄傲和不舍。

## 幼儿启蒙期（0-5岁）
在小明的幼儿时期，你就展现出了耐心和智慧。面对他不愿分享玩具的问题，你没有强迫，而是通过寓教于乐的方式让他理解分享的快乐。这种教育方式为他后来的人际交往能力奠定了良好基础。

## 兴趣培养期（6-10岁）
小学阶段，你面临了很多家长都会遇到的问题：孩子更热爱运动而不是学习。但你的智慧在于找到了平衡点，让小明明白学习和兴趣并不冲突。当他遭遇校园欺凌时，你教会了他自信和求助的重要性。

## 品格塑造期（11-15岁）
青春期的叛逆没有击垮你们的亲子关系。你给了小明成长的空间，同时在关键时刻给予指导。这种"收放自如"的教育方式让小明学会了独立思考和承担责任。

## 梦想支持期（16-18岁）
面对小明选择体育专业的决定，你内心的担忧是可以理解的。但最终你选择了支持，这种无条件的信任给了小明追求梦想的勇气，也让他更加珍惜这份支持。

## 育儿成果
今天的小明不仅是一个优秀的学生和有潜力的运动员，更重要的是他成为了一个有温度的人。他懂得感恩，善待他人，对未来有清晰的规划。这些品质，正是你十八年来悉心栽培的结果。

你的育儿之路证明了一个道理：真正的教育不是控制，而是引导；不是限制，而是支持。小明带着你给他的爱和价值观走向更广阔的人生舞台，这是对你最好的回报。

<!-- story_style: 温暖水彩 -->`
};

// Export both for easy access
export const mockGameStates = {
  english: mockGameStateEnglish,
  chinese: mockGameStateChinese,
}; 