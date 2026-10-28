<!-- 速算技巧手册：百化分速查表 / 平方数速查表 / 幂次估算表（与主版本数据一致） -->
<script setup lang="ts">
import { computed } from 'vue'

const PERCENT_TABLE: Array<[number, number, string]> = [
  [1, 2, '50%'], [1, 3, '33.3%'], [1, 4, '25%'], [1, 5, '20%'],
  [1, 6, '16.7%'], [1, 7, '14.3%'], [1, 8, '12.5%'], [1, 9, '11.1%'],
  [1, 10, '10%'], [1, 11, '9.1%'], [1, 12, '8.3%'], [1, 13, '7.7%'],
  [1, 14, '7.1%'], [1, 15, '6.7%'], [1, 16, '6.25%'], [1, 17, '5.9%'],
  [1, 18, '5.6%'], [1, 19, '5.3%'], [1, 20, '5%'],
]

const SQUARE_TABLE: Array<[number, number]> = [
  [1, 1], [2, 4], [3, 9], [4, 16], [5, 25], [6, 36], [7, 49], [8, 64],
  [9, 81], [10, 100], [11, 121], [12, 144], [13, 169], [14, 196],
  [15, 225], [16, 256], [17, 289], [18, 324], [19, 361], [20, 400],
]

const POW_TABLE: Array<[string, string]> = [
  ['1.2³', '1.7'], ['1.2⁴', '2'], ['1.3³', '2.2'], ['1.3⁴', '2.9'],
  ['1.4³', '2.7'], ['1.4⁴', '3.8'], ['1.05⁴', '1.21'], ['1.1⁴', '1.46'],
  ['1.15⁴', '1.75'], ['1.1⁵', '1.61'],
]

/** 列优先对折排版（先左列后右列，与主版本一致） */
function halve<T>(rows: T[]): Array<[T, T | null]> {
  const half = Math.ceil(rows.length / 2)
  const out: Array<[T, T | null]> = []
  for (let i = 0; i < half; i++) {
    out.push([rows[i], rows[i + half] || null])
  }
  return out
}

const percentRows = computed(() => halve(PERCENT_TABLE))
const squareRows = computed(() => halve(SQUARE_TABLE))
const powRows = computed(() => halve(POW_TABLE))
</script>

<template>
  <div class="manual">
    <el-card shadow="never" class="m-card">
      <template #header><b>百化分速查表（1/2 ~ 1/20）</b></template>
      <table class="m-table">
        <tbody>
          <tr v-for="(r, i) in percentRows" :key="i">
            <td>{{ r[0][0] }}/{{ r[0][1] }}</td>
            <td>{{ r[0][2] }}</td>
            <td>{{ r[1] ? `${r[1][0]}/${r[1][1]}` : '—' }}</td>
            <td>{{ r[1] ? r[1][2] : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </el-card>

    <el-card shadow="never" class="m-card">
      <template #header><b>平方数速查表（1² ~ 20²）</b></template>
      <table class="m-table">
        <tbody>
          <tr v-for="(r, i) in squareRows" :key="i">
            <td>{{ r[0][0] }}²</td>
            <td>{{ r[0][1] }}</td>
            <td>{{ r[1] ? `${r[1][0]}²` : '—' }}</td>
            <td>{{ r[1] ? r[1][1] : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </el-card>

    <el-card shadow="never" class="m-card">
      <template #header><b>幂次估算速查表（1.x 连乘近似值，资料分析增长类常用）</b></template>
      <table class="m-table">
        <tbody>
          <tr v-for="(r, i) in powRows" :key="i">
            <td>{{ r[0][0] }}</td>
            <td>{{ r[0][1] }}</td>
            <td>{{ r[1] ? r[1][0] : '—' }}</td>
            <td>{{ r[1] ? r[1][1] : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </el-card>
  </div>
</template>

<style scoped>
.manual {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.m-table {
  width: 100%;
  border-collapse: collapse;
}
.m-table td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 6px 12px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.m-table td:nth-child(odd) {
  background: var(--el-fill-color-blank);
  font-weight: 600;
}
</style>
