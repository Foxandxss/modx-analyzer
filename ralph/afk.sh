#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  # Opt-in gate: only issues explicitly promoted to `ready-for-agent` reach the
  # unattended loop. Everything else (needs-triage, ready-for-human, unlabeled)
  # is off-limits until a human reviews it. Opt-in > opt-out: a forgotten
  # include-label is safe (nothing runs); a forgotten exclude-label would leak.
  issues=$(gh issue list --state open --label ready-for-agent --json number,title,body,comments)
  prompt=$(cat ralph/prompt.md)

  printf '%s' "Previous commits: $commits $issues $prompt" \
  | claude \
      --dangerously-skip-permissions \
      --verbose \
      --model opus \
      --print \
      --output-format stream-json \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi
done
