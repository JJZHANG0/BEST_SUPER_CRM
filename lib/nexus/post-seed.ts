/**
 * Example 推文 bundled with every build (and inserted by server/seed.ts if missing), so the
 * public link works on GitHub Pages for anyone: e.g. https://jjzhang0.github.io/BEST_SUPER_CRM/#/p/bpa-autumn-kickoff
 * Posts written on the Pages preview stay in that browser only.
 */
import type { ArticlePost } from './posts';

const at = '2026-10-10 18:30';
export const seedPosts: ArticlePost[] = [
  {
    id: 'POST-seed-bpa-1', slug: 'bpa-autumn-kickoff', program: 'bpa', status: 'published', author: '许瑾老师', authorEmail: 'xujin@nexus.local',
    createdAt: at, updated: at, publishedAt: at, metrics: { views: 0, shares: 0, likes: 0 },
    draft: {
      title: 'BPA 秋季赛季开营｜在真实商业挑战里练就表达力',
      summary: '从案例拆解到模拟答辩，带学生完成一份能上赛场的商业计划书。本文介绍课程节奏、适合人群与报名方式。',
      cover: 'materials/cover-bpa.svg',
      blocks: [
        { id: 'b1', type: 'paragraph', text: 'BPA 美国商业全能挑战赛是面向高中生的综合商业赛事。比起背诵商业概念，我们更关心学生能否看懂一家公司、讲清一个机会，并在评委面前自信表达。' },
        { id: 'b2', type: 'heading', text: '这一季我们会做什么' },
        { id: 'b3', type: 'paragraph', text: '以真实企业案例为起点，学会用数据说话；\n小组协作完成商业计划书与财务预测；\n两轮模拟答辩，提前熟悉赛场节奏。' },
        { id: 'b4', type: 'image', src: 'materials/scene-showcase.svg', caption: '模拟答辩现场（示意图）' },
        { id: 'b5', type: 'quote', text: '好的商业表达，是把复杂的判断讲成一个可信的故事。' },
        { id: 'b6', type: 'highlight', kind: 'tip', title: '报名方式', items: [{ label: '咨询', value: '联系你的负责顾问老师' }, { label: '说明', value: '具体费用与开课时间以正式报价为准' }] },
      ],
    },
    published: null,
  },
  {
    id: 'POST-seed-ctb-1', slug: 'ctb-research-guide', program: 'ctb', status: 'published', author: '方彦淇老师', authorEmail: 'fangyanqi@nexus.local',
    createdAt: at, updated: at, publishedAt: at, metrics: { views: 0, shares: 0, likes: 0 },
    draft: {
      title: '从一个真实问题出发｜CTB 研究选题的三个小建议',
      summary: '题目太大、资料太散、结论太空，是青年研究最常见的三个坑。CTB 导师分享如何把问题问得更好。',
      cover: 'materials/cover-ctb.svg',
      blocks: [
        { id: 'c1', type: 'paragraph', text: 'CTB 全球青年创新论坛鼓励青年用跨学科视角回应社会挑战。很多同学第一次做研究时，最难的不是写报告，而是找到一个“刚刚好”的问题。' },
        { id: 'c2', type: 'heading', text: '建议一：从身边的现象开始' },
        { id: 'c3', type: 'paragraph', text: '与其研究“城市交通拥堵”，不如观察“学校门口放学 15 分钟内的接送车流”。范围小，数据才拿得到，结论才站得住。' },
        { id: 'c4', type: 'heading', text: '建议二：先问“谁在乎”' },
        { id: 'c5', type: 'paragraph', text: '一个好问题一定有真实的利益相关方。试着列出三类会关心你结论的人，再决定访谈谁、问卷发给谁。' },
        { id: 'c6', type: 'image', src: 'materials/scene-research.svg', caption: '研究讨论（示意图）' },
        { id: 'c7', type: 'quote', text: '研究不是寻找标准答案，而是把问题问得更好。' },
      ],
    },
    published: null,
  },
  {
    id: 'POST-seed-conrad-1', slug: 'conrad-prototype-week', program: 'conrad', status: 'draft', author: '许瑾老师', authorEmail: 'xujin@nexus.local',
    createdAt: at, updated: at, publishedAt: null, metrics: { views: 0, shares: 0, likes: 0 },
    draft: {
      title: '康莱德原型周｜两周一次评审是怎样进行的',
      summary: '草稿：介绍原型迭代与评审节奏，发布前请补充真实照片与时间安排。',
      cover: 'materials/cover-conrad.svg',
      blocks: [
        { id: 'd1', type: 'paragraph', text: '康莱德创新挑战赛强调“先验证、再完善”。原型周里，每支队伍都要带着可以被试用的东西来评审。' },
      ],
    },
    published: null,
  },
];
// Published seeds show exactly their draft.
for (const p of seedPosts) if (p.status === 'published') p.published = JSON.parse(JSON.stringify(p.draft));
