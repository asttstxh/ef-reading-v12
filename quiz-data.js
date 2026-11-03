export const QUESTIONS = {
 hat: {id:'hat',level:1,skill:'词语识别',title:'给小背包装一顶帽子',hint:'读一读，点出它的样子',text:'red hat',choices:[{id:'blue-hat',art:'hat-blue',label:'蓝帽子'},{id:'red-bag',art:'bag-red',label:'红书包'},{id:'red-hat',art:'hat-red',label:'红帽子'},{id:'red-shoe',art:'shoe-red',label:'红鞋子'}],correct:'red-hat'},
 cat: {id:'cat',level:1,skill:'听懂句子',title:'小猫躲到哪里啦？',hint:'听一听，再选一张图',audio:'The cat is under the chair.',choices:[{id:'on',art:'cat-on',label:'图一'},{id:'beside',art:'cat-beside',label:'图二'},{id:'under',art:'cat-under',label:'图三'},{id:'behind',art:'cat-behind',label:'图四'}],correct:'under'},
 animal: {id:'animal',level:1,skill:'词语识别',title:'找到这位小伙伴',hint:'读一读，点出它',text:'dog',choices:[{id:'cat',art:'cat',label:'小猫'},{id:'dog',art:'dog',label:'小狗'},{id:'pig',art:'pig',label:'小猪'},{id:'hen',art:'hen',label:'母鸡'}],correct:'dog'},
 mia: {id:'mia',level:2,skill:'读懂细节',title:'哪一位是 Mia？',hint:'她的帽子和书包，会告诉你',text:'Mia has a red hat and a blue bag.',choices:[{id:'bb',art:'child-blue-blue',label:'图一'},{id:'rb',art:'child-red-blue',label:'图二'},{id:'rr',art:'child-red-red',label:'图三'},{id:'br',art:'child-blue-red',label:'图四'}],correct:'rb'},
 pig: {id:'pig',level:1,skill:'理解句意',title:'小猪在做什么？',hint:'选出和句子一样的画面',text:'The pig is sleeping.',choices:[{id:'running',art:'pig-running',label:'图一'},{id:'sleeping',art:'pig-sleeping',label:'图二'},{id:'eating',art:'pig-eating',label:'图三'}],correct:'sleeping'},
 apple: {id:'apple',level:2,skill:'读懂动作',title:'Ben 找到了什么？',hint:'读两句，找出最后的画面',text:'Ben opens his bag. He takes out an apple.',choices:[{id:'book',art:'hold-book',label:'图一'},{id:'apple',art:'hold-apple',label:'图二'},{id:'ball',art:'hold-ball',label:'图三'}],correct:'apple'},
 before: {id:'before',level:3,skill:'理解顺序',title:'先做哪件小事？',hint:'每张卡片，从左往右看',text:'Mia feeds the cat before she waters the flowers.',choices:[{id:'water-cat',art:'sequence-water-cat',label:'图一'},{id:'cat-book',art:'sequence-cat-book',label:'图二'},{id:'cat-water',art:'sequence-cat-water',label:'图三'}],correct:'cat-water'},
 count: {id:'count',level:1,skill:'词语识别',title:'帮野餐篮找水果',hint:'选出它想要的水果',text:'two apples',choices:[{id:'one',art:'apples-1',label:'一'},{id:'three',art:'apples-3',label:'二'},{id:'two',art:'apples-2',label:'三'}],correct:'two'},
 ball: {id:'ball',level:2,skill:'理解句意',title:'找到藏好的红球',hint:'留意句子里的两个位置',text:'The ball is behind the box, not inside it.',choices:[{id:'inside',art:'ball-inside',label:'图一'},{id:'beside',art:'ball-beside',label:'图二'},{id:'behind',art:'ball-behind',label:'图三'}],correct:'behind'},
 clouds: {id:'clouds',level:3,skill:'发现线索',title:'Leo 为什么要回家？',hint:'最后一个小发现',text:'Leo sees dark clouds. He takes his kite home. Why?',choices:[{id:'hungry',art:'food',label:'He is hungry.'},{id:'rain',art:'rain',label:'Rain may be coming.'},{id:'sleep',art:'bed',label:'He wants to sleep.'}],correct:'rain',showLabels:true}
};
export function nextQuestion(answers){
 if(answers.length===0)return QUESTIONS.hat;
 if(answers.length===1)return QUESTIONS.cat;
 const n=answers.filter(x=>x.correct).length;
 if(answers.length===2)return n===0?QUESTIONS.animal:QUESTIONS.mia;
 if(answers.length===3){
  if(answers[2].level===2&&answers[2].correct&&n>=2)return QUESTIONS.before;
  return n>=1?QUESTIONS.apple:QUESTIONS.pig;
 }
 if(answers.length===4){
  if(answers[3].level===3&&answers[3].correct)return QUESTIONS.clouds;
  return answers.some(x=>x.level>=2&&x.correct)?QUESTIONS.ball:QUESTIONS.count;
 }
 return null;
}
export function recommendLevel(answers){
 const reading=answers.filter(x=>x.id!=='cat'&&x.correct);
 const high=reading.filter(x=>x.level===3).length;
 const mid=reading.filter(x=>x.level>=2).length;
 if(high>=2&&mid>=3)return 3;
 if(mid>=2 || (mid>=1&&answers[0]?.correct&&answers[1]?.correct))return 2;
 return 1;
}
export const LEVELS={
 1:{name:'看图听读',tag:'从一句话开始',description:'跟着大图和声音，轻松走进故事。',color:'#3b8069'},
 2:{name:'故事探索',tag:'读懂发生了什么',description:'读短句、找细节，串起故事的小发现。',color:'#bb7641'},
 3:{name:'线索挑战',tag:'多发现一点点',description:'把线索连起来，读懂人物为什么这样做。',color:'#7472ad'}
};
