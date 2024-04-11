import fs from 'fs'
import readline from 'readline'
import path from 'path'
import iconv from 'iconv-lite'
import ejs from 'ejs'
import { Command } from 'commander'


const program = new Command()
program
  .description('MoE のログファイルからメモリーズボックスの枠拡張のログを収集して userdata/inventory.html に出力します。')
  .option('-p, --path <path>', 'userdata フォルダのパス', 'C:/app/Master of Epic/userdata')
  .option('-n, --number <number>', 'mlog_yy_mm_dd_n.txt の n', 0)
  .option('-l, --limit <limit>', 'ログファイルをいくつまで遡るか。 0 で制限なし', 100)
  .parse(process.argv)
const options = program.opts()

const charaDirRegex = /(DIAMOND|PEARL|EMERALD)_([^_]+)_$/
const logFileRegex = new RegExp(`^mlog_\\d+_\\d+_\\d+_${options.number}\\.txt$`)
const logRegex = /^[\d/]+ [\d:]+ \[ (○|×) \] (.+?) : \+ (\d+)$/
const inventoryRegex = /^所持枠拡張数/
const bankRegex = /^銀行枠拡張数/
const quests = [
  { key: '２つ星の依頼 ( チップx2 )', shortName: '2枚', ex: 2, type: 'inventory', },
  { key: '３つ星の依頼 ( ワンダー クロース )', shortName: '布', ex: 3, type: 'inventory', },
  { key: '５つ星の依頼 ( アイリーンズ ベル )', shortName: '鈴', ex: 5, type: 'inventory', },
  { key: 'ジャネット 銀行拡張1 ( 1,000 Gold )', shortName: '1k', ex: 1, type: 'bank', },
  { key: 'ジャネット 銀行拡張2 ( 2,000 Gold )', shortName: '2k', ex: 1, type: 'bank', },
  { key: 'ジャネット 銀行拡張3 ( 4,000 Gold )', shortName: '4k', ex: 1, type: 'bank', },
  { key: 'ジャネット 銀行拡張4 ( 8,000 Gold )', shortName: '8k', ex: 2, type: 'bank', },
  { key: 'ジャネット 銀行拡張5 ( 16,000 Gold )', shortName: '16k', ex: 2, type: 'bank', },
  { key: 'ジャネット 銀行拡張6 ( 32,000 Gold )', shortName: '32k', ex: 3, type: 'bank', },
  { key: 'ジャネット 銀行拡張7 ( 64,000 Gold )', shortName: '64k', ex: 3, type: 'bank', },
  { key: 'キャット 銀行拡張1 ( ティアーズ ドロップ )', shortName: 'ティア', ex: 2, type: 'bank', },
  { key: 'キャット 銀行拡張2 ( ビサイド ユア ハート )', shortName: 'ビサ', ex: 2, type: 'bank', },
  { key: '２つ星の願い ( 各種生産物 )', shortName: 'IVP', ex: 2, type: 'bank', },
  { key: '３つ星の願い ( チップx9 )', shortName: '9枚', ex: 3, type: 'bank', },
  { key: '４つ星の願い ( チップx15 )', shortName: '15枚', ex: 4, type: 'bank', },
  { key: 'ガータンの銀行拡張 ( ナジャの爪 )', shortName: 'ナジャ', ex: 4, type: 'bank', },
  { key: 'イルムの銀行拡張 ( キノコの化石 )', shortName: '茸', ex: 3, type: 'bank', },
  { key: '旅商の安全確保 ( サベージ討伐 )', shortName: 'サベ', ex: 1, type: 'bank', },
  { key: '王国復興 極秘任務 ( 各種生産物 )', shortName: '任務', ex: 1, type: 'bank', },
  { key: '悪しき贅沢と正義の盗み ( 隠し金庫 )', shortName: '金庫', ex: 1, type: 'bank', },
  { key: '邪竜討伐 ( 千年竜 )', shortName: '千年', ex: 2, type: 'bank', },
  { key: 'エルアン宮殿での銀行拡張 ( 賢王の証 )', shortName: '賢王', ex: 2, type: 'bank', },
  { key: '侵略者の調査依頼', shortName: '蟻', ex: 3, type: 'bank', },
  { key: '未確認生物を追え！', shortName: 'ヒト', ex: 2, type: 'bank', },
  { key: '研究素材を手に入れろ！', shortName: 'タコ', ex: 2, type: 'bank', },
  { key: '新種の生物を発見せよ！', shortName: 'エビ', ex: 2, type: 'bank', },
  { key: 'ライオン討伐', shortName: '獅子', ex: 2, type: 'bank', },
]

update()


async function update () {
  const charaList = fs.readdirSync(options.path, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const m = dirent.name.match(charaDirRegex)
      if (m) {
        return {
          dirent: dirent,
          server: m[1],
          name: m[2].replace(/\./g, ''),
          inventory: { updated: '', quests: {} },
          bank: { updated: '', quests: {} },
        }
      }
    })
    .filter(entry => entry)
    .sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : 1)

  for (const entry of charaList) {
    await readLogfile(entry)
  }

  const context = []

  for (const server of ['DIAMOND', 'PEARL', 'EMERALD']) {
    const ctx = {
      name: server,
      charaList: [],
    }
    context.push(ctx)

    for (const entry of charaList.filter(entry => entry.server === server)) {
      const chara = []
      ctx.charaList.push(chara)
      chara.push(entry.name)

      for (const q of quests) {
        chara.push(entry[q.type].quests[q.key] ? '◯' : '')
      }

      chara.push([entry['inventory'].updated, entry['bank'].updated].join(' '))
    }
  }

  ejs.renderFile('./template/inventory.ejs', { quests: quests, data: context }, (err, html) => {
    if (err) {
      console.log(err)
    }
    else {
      try {
        fs.writeFileSync(path.join(options.path, 'inventory.html'), html, 'utf8')
      }
      catch (err) {
        throw err
      }
    }
  })
}


async function readLogfile(entry) {
  const logList = fs.readdirSync(path.join(entry.dirent.path, entry.dirent.name), { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.match(logFileRegex))
    .sort((a, b) => b.name < a.name ? -1 : 1)

  for (let i = 0; i < logList.length; i++) {
    if ((options.limit && i > options.limit) || (entry.inventory.updated && entry.bank.updated)) {
      break
    }

    let mode
    const dirent = logList[i]
    const readStream = readline.createInterface({
      input: fs.createReadStream(path.join(dirent.path, dirent.name)).pipe(iconv.decodeStream('Shift_JIS'))
    })

    for await (const line of readStream) {
      if (line.match(inventoryRegex)) {
        mode = 'inventory'
      }
      else if (line.match(bankRegex)) {
        mode = 'bank'
      }

      if (mode && dirent.name >= entry[mode].updated) {
        entry[mode].updated = dirent.name
        const m = line.match(logRegex)
        if (m) {
          entry[mode].quests[m[2]] = (m[1] === '○')
        }
      }
    }

    readStream.close()
  }
}

