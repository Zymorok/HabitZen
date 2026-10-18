// NOTE: В браузере уведомление об окончании не планируется: вкладка сама покажет конец таймера.
export async function scheduleFocusAlert(
  _atMs: number,
  _content: { readonly title: string; readonly body: string; readonly channelName: string },
): Promise<boolean> {
  void _atMs;
  void _content;
  return false;
}

export async function cancelFocusAlert(): Promise<void> {}
