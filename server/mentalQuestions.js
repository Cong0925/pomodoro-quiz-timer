/* ============================================================
 * 刷题计时器 - server/mentalQuestions.js
 * 速算题目种子数据（系统内置题库）
 * 首次启动/访问时自动写入 mental_questions（表空时填充，幂等）。
 * 题型：percent=百化分  compare=分数比大小  estimate=估算值
 * options 为选项文本数组；answer 为正确选项下标；tip 为技巧提示
 * ============================================================ */

const QUESTIONS = [
    /* ---------- 百化分（分数 ↔ 百分数互化）；fillable=1 表示常规几分之一型，可进入填空题模式 ---------- */
    { qtype: 'percent', difficulty: 1, stem: '1/5 ≈ ?', options: ['20%', '25%', '16.7%', '12.5%'], answer: 0, tip: '1/5 = 20%。÷20% 即 ×5。', tag: '百化分-基础', fillable: 1 },
    { qtype: 'percent', difficulty: 1, stem: '1/4 ≈ ?', options: ['25%', '20%', '33.3%', '12.5%'], answer: 0, tip: '1/4 = 25%。÷25% 即 ×4。', tag: '百化分-基础', fillable: 1 },
    { qtype: 'percent', difficulty: 1, stem: '1/6 ≈ ?', options: ['16.7%', '14.3%', '15.4%', '17.6%'], answer: 0, tip: '1/6 ≈ 16.7%。记住 6 的倒数 16.7%。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 1, stem: '12.5% ≈ ?', options: ['1/8', '1/7', '1/6', '1/9'], answer: 0, tip: '12.5% = 1/8。÷12.5% 即 ×8。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '1/7 ≈ ?', options: ['14.3%', '12.5%', '16.7%', '11.1%'], answer: 0, tip: '1/7 ≈ 14.3%。÷14.3% 即 ×7。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '33.3% ≈ ?', options: ['1/3', '1/4', '1/5', '1/6'], answer: 0, tip: '33.3% = 1/3。×33.3% 即 ÷3。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '1/9 ≈ ?', options: ['11.1%', '10.9%', '12.5%', '9.1%'], answer: 0, tip: '1/9 ≈ 11.1%。÷11.1% 即 ×9。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '1/11 ≈ ?', options: ['9.1%', '9.9%', '8.8%', '10.1%'], answer: 0, tip: '1/11 ≈ 9.1%。9 的倍数特征辅助记忆。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '1/12 ≈ ?', options: ['8.3%', '9.1%', '7.7%', '8.8%'], answer: 0, tip: '1/12 ≈ 8.3%。×8.3% 即 ÷12。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '62.5% ≈ ?', options: ['5/8', '3/5', '5/7', '2/3'], answer: 0, tip: '62.5% = 5/8（62.5 × 8 = 500）。', tag: '百化分-进阶', fillable: 0 },
    { qtype: 'percent', difficulty: 2, stem: '16.7% ≈ ?', options: ['1/6', '1/5', '1/7', '1/8'], answer: 0, tip: '16.7% = 1/6。与 1/6、33.3%、66.7% 一组记忆。', tag: '百化分-常用', fillable: 1 },
    { qtype: 'percent', difficulty: 2, stem: '1/13 ≈ ?', options: ['7.7%', '7.1%', '6.9%', '8.3%'], answer: 0, tip: '1/13 ≈ 7.7%。7.7 × 13 ≈ 100。', tag: '百化分-进阶', fillable: 1 },
    { qtype: 'percent', difficulty: 3, stem: '87.5% ≈ ?', options: ['7/8', '5/6', '6/7', '4/5'], answer: 0, tip: '87.5% = 7/8。12.5% 的 7 倍。', tag: '百化分-进阶', fillable: 0 },
    { qtype: 'percent', difficulty: 3, stem: '1/17 ≈ ?', options: ['5.9%', '5.3%', '6.7%', '6.25%'], answer: 0, tip: '1/17 ≈ 5.9%。17 的倒数 ≈ 5.9%。', tag: '百化分-进阶', fillable: 1 },

    /* ---------- 分数比大小（交叉相乘） ---------- */
    { qtype: 'compare', difficulty: 1, stem: '3/8 与 2/5', options: ['3/8 更大', '2/5 更大'], answer: 1, tip: '交叉相乘：3×5=15，2×8=16，15<16，故 2/5 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 1, stem: '5/8 与 3/5', options: ['5/8 更大', '3/5 更大'], answer: 0, tip: '交叉相乘：5×5=25，3×8=24，25>24，故 5/8 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 2, stem: '3/7 与 4/9', options: ['3/7 更大', '4/9 更大'], answer: 1, tip: '交叉相乘：3×9=27，4×7=28，27<28，故 4/9 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 2, stem: '2/5 与 3/7', options: ['2/5 更大', '3/7 更大'], answer: 1, tip: '交叉相乘：2×7=14，3×5=15，14<15，故 3/7 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 2, stem: '4/7 与 5/9', options: ['4/7 更大', '5/9 更大'], answer: 0, tip: '交叉相乘：4×9=36，5×7=35，36>35，故 4/7 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 2, stem: '6/11 与 7/13', options: ['6/11 更大', '7/13 更大'], answer: 0, tip: '交叉相乘：6×13=78，7×11=77，78>77，故 6/11 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 2, stem: '7/9 与 5/7', options: ['7/9 更大', '5/7 更大'], answer: 0, tip: '交叉相乘：7×7=49，5×9=45，49>45，故 7/9 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 3, stem: '8/15 与 5/9', options: ['8/15 更大', '5/9 更大'], answer: 1, tip: '交叉相乘：8×9=72，5×15=75，72<75，故 5/9 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 3, stem: '11/18 与 2/3', options: ['11/18 更大', '2/3 更大'], answer: 1, tip: '交叉相乘：11×3=33，2×18=36，33<36，故 2/3 更大。', tag: '交叉相乘' },
    { qtype: 'compare', difficulty: 3, stem: '5/6 与 7/9', options: ['5/6 更大', '7/9 更大'], answer: 0, tip: '交叉相乘：5×9=45，7×6=42，45>42，故 5/6 更大。', tag: '交叉相乘' },

    /* ---------- 估算值（取整快速估算） ---------- */
    { qtype: 'estimate', difficulty: 1, stem: '29.8 × 5.1 ≈ ?', options: ['150', '160', '140', '130'], answer: 0, tip: '取整：30 × 5 = 150。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 1, stem: '5.02 × 39.8 ≈ ?', options: ['200', '195', '205', '190'], answer: 0, tip: '取整：5 × 40 = 200。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 1, stem: '3.98 × 25 ≈ ?', options: ['100', '105', '95', '110'], answer: 0, tip: '取整：4 × 25 = 100。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 1, stem: '2.99 × 7.1 ≈ ?', options: ['21', '20', '22', '19'], answer: 0, tip: '取整：3 × 7 = 21。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 2, stem: '601 × 799 ≈ ?', options: ['48 万', '50 万', '46 万', '52 万'], answer: 0, tip: '取整：600 × 800 = 48 万。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 2, stem: '9876 ÷ 49 ≈ ?', options: ['200', '220', '180', '240'], answer: 0, tip: '取整：10000 ÷ 50 = 200。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 2, stem: '499 × 61 ≈ ?', options: ['30000', '31000', '29000', '32000'], answer: 0, tip: '取整：500 × 60 = 30000。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 2, stem: '8102 ÷ 41 ≈ ?', options: ['200', '210', '190', '220'], answer: 0, tip: '取整：8000 ÷ 40 = 200。', tag: '凑整估算' },
    { qtype: 'estimate', difficulty: 3, stem: '12.9% × 820 ≈ ?', options: ['105', '95', '110', '90'], answer: 0, tip: '12.9% ≈ 12.5% = 1/8，820 ÷ 8 ≈ 102.5，最接近 105（百化分+估算结合）。', tag: '百化分+估算' },
    { qtype: 'estimate', difficulty: 3, stem: '6.1% × 1950 ≈ ?', options: ['120', '115', '125', '110'], answer: 0, tip: '6.1% ≈ 6%，1950 ≈ 2000，6% × 2000 = 120。', tag: '百分数估算' },

    /* ---------- 平方数（1~20 的平方；fillable=1，未来可开启填空题模式：填纯数字） ---------- */
    { qtype: 'square', difficulty: 1, stem: '1² = ?', options: ['1', '4', '9', '2'], answer: 0, tip: '1² = 1。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '2² = ?', options: ['4', '9', '1', '6'], answer: 0, tip: '2² = 4。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '3² = ?', options: ['9', '16', '4', '6'], answer: 0, tip: '3² = 9。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '4² = ?', options: ['16', '25', '9', '12'], answer: 0, tip: '4² = 16。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '5² = ?', options: ['25', '36', '16', '20'], answer: 0, tip: '5² = 25。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '6² = ?', options: ['36', '49', '25', '30'], answer: 0, tip: '6² = 36。', tag: '平方数-基础', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '7² = ?', options: ['49', '64', '36', '42'], answer: 0, tip: '7² = 49。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '8² = ?', options: ['64', '81', '49', '56'], answer: 0, tip: '8² = 64。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '9² = ?', options: ['81', '100', '64', '72'], answer: 0, tip: '9² = 81。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '10² = ?', options: ['100', '121', '81', '90'], answer: 0, tip: '10² = 100。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '11² = ?', options: ['121', '144', '100', '110'], answer: 0, tip: '11² = 121。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '12² = ?', options: ['144', '169', '121', '132'], answer: 0, tip: '12² = 144。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '13² = ?', options: ['169', '196', '144', '156'], answer: 0, tip: '13² = 169。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '14² = ?', options: ['196', '225', '169', '182'], answer: 0, tip: '14² = 196。', tag: '平方数-常用', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '15² = ?', options: ['225', '256', '196', '210'], answer: 0, tip: '15² = 225。', tag: '平方数-进阶', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '16² = ?', options: ['256', '289', '225', '240'], answer: 0, tip: '16² = 256。', tag: '平方数-进阶', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '17² = ?', options: ['289', '324', '256', '272'], answer: 0, tip: '17² = 289。', tag: '平方数-进阶', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '18² = ?', options: ['324', '361', '289', '306'], answer: 0, tip: '18² = 324。', tag: '平方数-进阶', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '19² = ?', options: ['361', '400', '324', '342'], answer: 0, tip: '19² = 361。', tag: '平方数-进阶', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '20² = ?', options: ['400', '441', '361', '380'], answer: 0, tip: '20² = 400。', tag: '平方数-进阶', fillable: 1 },
    /* 反向：由平方数反推底数（11~18） */
    { qtype: 'square', difficulty: 1, stem: '121 = ?²', options: ['10', '11', '12', '13'], answer: 1, tip: '121 = 11²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 1, stem: '144 = ?²', options: ['12', '13', '11', '14'], answer: 0, tip: '144 = 12²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '169 = ?²', options: ['13', '12', '14', '15'], answer: 0, tip: '169 = 13²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '196 = ?²', options: ['14', '13', '15', '16'], answer: 0, tip: '196 = 14²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '225 = ?²', options: ['15', '14', '16', '17'], answer: 0, tip: '225 = 15²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 2, stem: '256 = ?²', options: ['16', '15', '17', '18'], answer: 0, tip: '256 = 16²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '289 = ?²', options: ['17', '16', '18', '15'], answer: 0, tip: '289 = 17²。', tag: '平方数-反查', fillable: 1 },
    { qtype: 'square', difficulty: 3, stem: '324 = ?²', options: ['18', '17', '19', '16'], answer: 0, tip: '324 = 18²。', tag: '平方数-反查', fillable: 1 }
];

module.exports = QUESTIONS;
