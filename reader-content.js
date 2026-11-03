// Points sit on illustrated objects. Every spoken target is an exact page sentence.
const POINTS = [
 {x:52,y:95,object:'小种子'}, {x:86,y:82,object:'树下的小狗'},
 {x:45,y:77,object:'浇水壶'}, {x:53,y:81,object:'金黄的麦子'},
 {x:53,y:89,object:'面粉碗'}, {x:49,y:86,object:'软软的面团'},
 {x:56,y:80,object:'刚出炉的面包'}, {x:69,y:85,object:'桌上的面包'}
];
const CLUES = {
 1:['种子在哪里？','谁来种种子？','谁给小苗浇水？','来读一读麦子的故事','谁在努力干活？','面团是谁做的？','找到香香的面包','把最后一句读给我听'],
 2:['她和谁住在农场？','小狗怎么回答？','小苗需要什么？','读一读麦子长大的样子','谁把麦子磨成面粉？','谁在独自揉面团？','面包现在闻起来怎样？','读一读小母鸡的回答'],
 3:['小母鸡的朋友在做什么？','小狗为什么不帮忙？','小猫为什么不愿离开？','读出小猪拒绝的原因','要得到面粉，还要做什么？','她又一次请朋友帮忙，为什么？','朋友们现在对什么感兴趣？','读出她最后的选择']
};
const INDICES = {1:[0,0,0,0,0,0,0,0],2:[1,2,0,0,2,2,2,1],3:[2,1,1,1,2,1,2,2]};
export function pageHotspots(level,page){
 const point={...POINTS[page]};
 if(page===0&&level>1)Object.assign(point,{x:79,y:79,object:'农场里的朋友'});
 if(page===1&&level===1)Object.assign(point,{x:48,y:93,object:'种下的种子'});
 if(page===2&&level===3)Object.assign(point,{x:76,y:66,object:'晒太阳的小猫'});
 if(page===3&&level===3)Object.assign(point,{x:87,y:74,object:'休息的小猪'});
 if(page===5&&level===3)Object.assign(point,{x:32,y:76,object:'小母鸡的翅膀'});
 if(page===6&&level===3)Object.assign(point,{x:72,y:68,object:'窗边的朋友'});
 if(page===7&&level===2)Object.assign(point,{x:37,y:75,object:'小母鸡'});
 if(page===7&&level===3)Object.assign(point,{x:77,y:74,object:'后悔的朋友'});
 return [{...point,id:'L'+level+'-p'+page,kind:page===3||page===7?'read':'clue',sentence:INDICES[level][page],prompt:CLUES[level][page]}];
}
export function storyKeywords(story,level){
 return [...new Map(story.levels[level].pages.flatMap(p=>p.words).map(w=>[w.id,w])).values()];
}
export function portraitStyle(scene){
 const air=[.45,.40,.45,.44,.58,.52,.55,.59][scene];
 const tall=scene<2||scene===4||scene===5;
 const height=scene>=6?768:tall?768:661;
 const sky=`--canopy:url(assets/canopy-${scene+1}-v12.webp);--sky:url(assets/sky-${scene+1}.webp);--sky-frac:${(air*height/512).toFixed(3)};`;
 if(scene===4||scene>=6)return sky+`--portrait:url(assets/reader-${scene+1}-v12.webp);--px:0%;--py:0%;--pw:100%;--ph:100%;--ratio:2/3`;
 const first=scene<4,upper=scene%4<2,y=upper?(first?107:73):875;
 return sky+'--portrait:url(assets/reader-'+(first?'1':'2-v12')+'.webp);--px:'+(scene%2?100:0)+'%;--py:'+(y/(1536-height)*100)+'%;--ph:'+(1536/height*100)+'%;--ratio:512/'+height;
}
