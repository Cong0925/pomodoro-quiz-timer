/* ============================================================
 * 刷题计时器 - server/defaultCategories.js
 * 内置默认分类（与旧版 dataModel.js 保持一致），
 * "恢复内置分类"功能使用
 * ============================================================ */
const DEFAULT_CATEGORIES = [
    {
        id: 'gk', name: '公务员考试', builtin: true, subs: [
            { id: 'gk-zz', name: '政治理论' },
            { id: 'gk-cs', name: '常识判断' },
            { id: 'gk-yy', name: '言语理解' },
            { id: 'gk-sl', name: '数量关系' },
            { id: 'gk-tx', name: '图形推理' },
            { id: 'gk-dy', name: '定义判断' },
            { id: 'gk-bl', name: '类比推理' },
            { id: 'gk-lj', name: '逻辑判断' },
            { id: 'gk-zl', name: '资料分析' },
            { id: 'gk-shenlun', name: '申论' },
            { id: 'gk-ms', name: '面试' }
        ]
    },
    {
        id: 'ky', name: '考研', builtin: true, subs: [
            { id: 'ky-zz', name: '政治' },
            { id: 'ky-yy', name: '英语' },
            { id: 'ky-sx', name: '数学' },
            { id: 'ky-gz', name: '管综' },
            { id: 'ky-fs', name: '法硕联考' },
            { id: 'ky-408', name: '计算机408' },
            { id: 'ky-jy', name: '教育学基础' },
            { id: 'ky-xl', name: '心理学基础' },
            { id: 'ky-ls', name: '历史学基础' },
            { id: 'ky-yx', name: '医学综合' },
            { id: 'ky-zy', name: '其他专业课' }
        ]
    },
    {
        id: 'sy', name: '事业单位', builtin: true, subs: [
            { id: 'sy-zc', name: '职测' },
            { id: 'sy-gg', name: '公基' },
            { id: 'sy-zy', name: '综应' },
            { id: 'sy-ms', name: '面试' }
        ]
    },
    {
        id: 'js', name: '教师资格/教师招聘', builtin: true, subs: [
            { id: 'js-zh', name: '综合素质' },
            { id: 'js-jy', name: '教育知识与能力' },
            { id: 'js-xk', name: '学科知识' },
            { id: 'js-jz', name: '教招笔试' },
            { id: 'js-ms', name: '面试' }
        ]
    },
    {
        id: 'yy', name: '语言考试', builtin: true, subs: [
            { id: 'yy-cet', name: '四六级' },
            { id: 'yy-ielts', name: '雅思' },
            { id: 'yy-toefl', name: '托福' },
            { id: 'yy-z4', name: '专四专八' },
            { id: 'yy-qt', name: '其他外语' }
        ]
    },
    {
        id: 'zj', name: '财会法律职业资格', builtin: true, subs: [
            { id: 'zj-fk', name: '法考' },
            { id: 'zj-cj', name: '初级会计' },
            { id: 'zj-zj', name: '中级会计' },
            { id: 'zj-cpa', name: 'CPA' },
            { id: 'zj-qt', name: '其他职业资格' }
        ]
    },
    {
        id: 'rc', name: '日常学习', builtin: true, subs: [
            { id: 'rc-bc', name: '编程' },
            { id: 'rc-wy', name: '外语' },
            { id: 'rc-yd', name: '阅读' },
            { id: 'rc-xz', name: '写作' },
            { id: 'rc-qt', name: '其他技能' }
        ]
    }
];

module.exports = DEFAULT_CATEGORIES;
