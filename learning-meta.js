// Language goals for the actual in-book activities; content tiers are not CEFR certificates.
export const GOALS = {
  "1": [
    {
      "id": "lrh-l1-listening",
      "label": "听力理解",
      "observable": "听懂小母鸡的英语动作短句，选出与声音一致的画面。",
      "evidenceSentenceIds": [
        "lrh-l1-p07-s01"
      ]
    }
  ],
  "2": [
    {
      "id": "lrh-l2-reading",
      "label": "阅读理解",
      "observable": "读懂人物行动的先后，并从对话中找到小母鸡独自吃面包的原因。",
      "evidenceSentenceIds": [
        "lrh-l2-p02-s01",
        "lrh-l2-p02-s02",
        "lrh-l2-p04-s02",
        "lrh-l2-p07-s02",
        "lrh-l2-p02-s03",
        "lrh-l2-p03-s03",
        "lrh-l2-p04-s03",
        "lrh-l2-p08-s02",
        "lrh-l2-p08-s03"
      ]
    }
  ],
  "3": [
    {
      "id": "lrh-l3-reading",
      "label": "阅读理解",
      "observable": "读懂人物态度和行为原因，选择原句证据，作出有依据的简单推想。",
      "evidenceSentenceIds": [
        "lrh-l3-p07-s02",
        "lrh-l3-p07-s03",
        "lrh-l3-p06-s02",
        "lrh-l3-p08-s02",
        "lrh-l3-p08-s03"
      ]
    }
  ]
};

export const LEXICON_INFO = {
  "label": "CEFR 对齐参考词库",
  "matching": "lemma + context-specific part of speech",
  "sources": [
    {
      "id": "CEFR-J-1.6",
      "url": "https://www.cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip",
      "reference": "https://www.cefr-j.org/download.html",
      "attribution": "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.",
      "license": "Research and commercial use with proper acknowledgement.",
      "sha256": "c837d2c00ab8954ed8db48e79afd8ef37099570295fec36950dbf9322303a37a"
    },
    {
      "id": "Octanove-1.0",
      "url": "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
      "reference": "https://github.com/openlanguageprofiles/olp-en-cefrj",
      "attribution": "Octanove Vocabulary Profile C1/C2 v1.0, Octanove Labs / Open Language Profiles",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "sha256": "18c33a407f2f89f7b8de9671c6d45fe3ea0bce45e7d2d7dcaab48d73e0f7b380"
    }
  ],
  "note": "词汇等级仅用于词条参考；L1、L2、L3是本体验的内容档位，不等同于CEFR等级或正式能力认证。未命中词条标为拓展词，不自动归为C2。",
  "ipaNote": "entries.json不包含音标。所列原形音标由编辑按常见美式读音编写，未作第三方词典逐词核验，不属于词库导出字段。"
};
