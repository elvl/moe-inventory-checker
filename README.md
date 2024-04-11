# moe-inventory-checker
MoE のログファイルからメモリーズボックスの枠拡張のログを収集して html に出力します。

## Options

* `--path` userdata フォルダのパス。出力もここにされます。 (default: "C:/app/Master of Epic/userdata")

* `--number` ログ番号。 mlog_yy_mm_dd_n.txt の n (default: 0)

* `--limit` ログファイルをいくつまで遡るか。 0 で制限なし (default: 100)