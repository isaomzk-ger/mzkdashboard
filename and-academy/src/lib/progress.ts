// 視聴順序の制御
// 並び順のレッスンに対し、「直前のレッスンを完了していれば次が解放」という
// 逐次アンロックの解放済みレッスン集合を返す。
// 先頭は常に解放。最初の未完了レッスンまでが解放され、それ以降はロック。
export function computeUnlocked(
  orderedLessonIds: string[],
  completed: Set<string>,
): Set<string> {
  const unlocked = new Set<string>();
  for (let i = 0; i < orderedLessonIds.length; i++) {
    if (i === 0 || completed.has(orderedLessonIds[i - 1])) {
      unlocked.add(orderedLessonIds[i]);
    } else {
      break;
    }
  }
  return unlocked;
}
