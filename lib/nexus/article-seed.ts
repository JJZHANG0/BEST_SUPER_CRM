import { programs, teams } from './data';
import { programOffers, cohortOffers, money } from './recruitment';
import type { ArticleBlock, ArticleContent, ProgramArticle } from './articles';

type Copy = { title: string; summary: string; intro: string; highlights: string[]; quote: string; scene: 'workshop' | 'research' | 'showcase' };
/** Demo editorial copy. Fictional — not official programme literature. */
const copy: Record<string, Copy> = {
  bpa: { title: '在真实商业挑战里，练就未来领导力', summary: '从案例拆解到模拟答辩，12 次课带学生完成一份能上赛场的商业计划书。', intro: 'BPA 美国商业全能挑战赛是面向高中生的综合商业赛事。比起背诵商业概念，我们更关心学生能否看懂一家公司、讲清一个机会，并在评委面前自信表达。', highlights: ['以真实企业案例为起点，学会用数据说话', '小组协作完成商业计划书与财务预测', '两轮模拟答辩，提前熟悉赛场节奏'], quote: '好的商业表达，是把复杂的判断讲成一个可信的故事。', scene: 'showcase' },
  ctb: { title: '从一个真实问题出发，做一次像样的研究', summary: '研究问题定义、调研方法、成果呈现，16 次课陪学生走完完整研究流程。', intro: 'CTB 全球青年创新论坛鼓励青年用跨学科视角回应社会挑战。项目会带学生从身边的现象中提炼研究问题，设计调研并形成有说服力的研究报告。', highlights: ['导师一对一打磨研究问题，避免“题目过大”', '访谈、问卷与二手资料相结合的调研训练', '论坛式展示，练习回应提问与讨论'], quote: '研究不是寻找标准答案，而是把问题问得更好。', scene: 'research' },
  conrad: { title: '把大胆的想法，做成能被验证的创新方案', summary: '选题、原型、商业验证到创新简报，20 次课完成一次完整的创新冲刺。', intro: '康莱德创新挑战赛聚焦科技与创新，要求学生针对真实世界的问题提出可落地的解决方案。项目强调“先验证、再完善”，让创意经得起追问。', highlights: ['用户访谈驱动选题，确保问题真实存在', '低成本原型快速迭代，每两周一次评审', '商业与技术双线验证，产出创新简报与路演'], quote: '创新不是灵光一现，而是一次次被验证的小步前进。', scene: 'workshop' },
  prime: { title: '与导师深度同行，完成属于自己的科研课题', summary: '文献检索、研究设计、实验分析与论文写作，16 次课建立严谨的科研思维。', intro: 'PrimeTeach 定制科研课题为有明确学科兴趣的学生匹配导师，围绕一个可执行的小课题开展系统研究，重视方法与过程记录。', highlights: ['按兴趣方向匹配导师，课题一人一案', '规范的文献综述与研究设计训练', '完整的数据分析与论文写作指导'], quote: '严谨，是科研给学生最长久的礼物。', scene: 'research' },
  ihosa: { title: '让健康议题被看见，让青年的声音被听见', summary: '议题研究、内容策划与公益传播实践，10 次课完成一次有影响力的公益行动。', intro: 'iHOSA-BCE 公益传媒研习连接健康议题与公益传播。学生将以小组形式选定议题，完成调研，并策划面向真实受众的传播作品。', highlights: ['从公共健康数据中发现值得关注的议题', '学习受众分析与内容脚本写作', '落地一次线上或校园公益传播活动'], quote: '公益传播的力量，来自真诚的故事与清晰的行动。', scene: 'showcase' },
  mvp: { title: '验证你的第一个创业想法，从用户访谈开始', summary: '用户访谈、产品设计、最小可行产品到创业路演，14 次课走完创业闭环。', intro: 'MVP 创业孵化面向有创业或产品想法的高中生，用精益创业的方法帮助学生快速验证需求，用最小成本做出第一个可以给用户试用的产品。', highlights: ['至少完成 10 位真实用户访谈', '无代码工具搭建可试用的产品原型', '模拟投资人路演，获得反馈与改进方向'], quote: '先做出来，再做得更好。', scene: 'workshop' },
  winter: { title: '一个寒假，把灵感变成可展示的作品', summary: '设计思维与动手制作结合，8 天集中营地完成团队创客作品并公开展示。', intro: '寒假创客马拉松营地以密集协作为特色。学生在导师带领下完成从发现问题、头脑风暴到动手制作的完整过程，最后在成果展上展示作品。', highlights: ['设计思维工作坊，学会定义真实问题', '每日动手制作时段，导师现场指导', '营地成果展，邀请家长与同学观展'], quote: '动手的那一刻，想法才真正开始生长。', scene: 'workshop' },
  summer: { title: '暑假创客营地 · 招生介绍筹备中', summary: '跨学科的夏日创作旅程，课程安排与营地日程将于近期发布，敬请期待。', intro: '暑假创客马拉松营地将延续寒假营地的协作模式，加入更多跨学科主题。具体课程与日程正在筹备中。', highlights: ['跨学科主题创作', '团队协作与公开展示', '更长的项目周期，作品更完整'], quote: '一场与伙伴共同探索可能的夏天。', scene: 'showcase' },
};

const sceneCaption = { workshop: '课堂掠影：小组协作与原型制作（示意图）', research: '课堂掠影：导师带领研究讨论（示意图）', showcase: '课堂掠影：成果展示与答辩（示意图）' };

export function articleContentFor(programId: string): ArticleContent {
  const p = programs.find(x => x.id === programId)!;
  const c = copy[programId], offer = programOffers[programId];
  const team = teams.find(t => t.program === programId);
  const cohort = team ? cohortOffers[team.id] : undefined;
  let n = 0;
  const id = () => `${programId}-b${++n}`;
  const blocks: ArticleBlock[] = [
    { id: id(), type: 'paragraph', text: c.intro },
    { id: id(), type: 'heading', text: '为什么选择这个项目' },
    { id: id(), type: 'paragraph', text: c.highlights.map((h, i) => `${String(i + 1).padStart(2, '0')}  ${h}`).join('\n') },
    { id: id(), type: 'image', src: `materials/scene-${c.scene}.svg`, caption: sceneCaption[c.scene] },
    { id: id(), type: 'heading', text: '课程怎么上' },
    { id: id(), type: 'paragraph', text: `项目共 ${offer.sessions} 次课、${offer.hours} 课时，采用线上小班与导师指导结合的方式。主要模块包括：\n${p.curriculum.split('\n').map(x => '· ' + x).join('\n')}` },
    { id: id(), type: 'highlight', kind: 'schedule', title: '时间安排', items: [
      { label: '计划开课', value: cohort?.opens ?? '待运营发布' },
      { label: '报名截止', value: cohort?.deadline ?? '待发布' },
      { label: '上课时间', value: cohort?.schedule ?? '开课前确认' },
      { label: '课程计划', value: `${offer.sessions} 次 · ${offer.hours} 课时` },
    ] },
    { id: id(), type: 'highlight', kind: 'eligibility', title: '适合谁来', items: [
      { label: '适合对象', value: offer.audience },
      { label: '预期成果', value: offer.outcome },
      { label: '授课形式', value: '线上小班 · 导师指导 · 小组实践' },
    ] },
    { id: id(), type: 'quote', text: c.quote },
    { id: id(), type: 'highlight', kind: 'price', title: '费用说明', items: [
      { label: '项目参考价', value: `${money(offer.fee)} / 人（演示）` },
      { label: '费用包含', value: '课程指导、阶段点评与成果辅导' },
      { label: '不含项目', value: '赛事报名、差旅与住宿' },
    ] },
    { id: id(), type: 'image', src: `materials/poster-${programId}.svg`, caption: '招生海报（演示版），可在项目详情中下载' },
    { id: id(), type: 'highlight', kind: 'tip', title: '如何报名', items: [
      { label: '报名方式', value: '联系负责顾问确认报名条件、费用与协议' },
      { label: '运营对接', value: offer.operations },
    ] },
  ];
  return { title: c.title, summary: c.summary, cover: `materials/cover-${programId}.svg`, blocks };
}

export const seedArticles: ProgramArticle[] = programs.map(p => {
  const content = articleContentFor(p.id);
  const live = p.published;
  return {
    program: p.id,
    author: programOffers[p.id].operations,
    draft: content,
    // The unpublished summer camp shows how a draft stays hidden from sales until ops publishes it.
    published: live ? JSON.parse(JSON.stringify(content)) : null,
    updated: '2026-10-09 18:20',
    publishedAt: live ? '2026-10-09 18:20' : null,
  };
});
