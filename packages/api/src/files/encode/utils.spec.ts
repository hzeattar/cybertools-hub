import { FileSources } from 'librechat-data-provider';
import { getFileStream } from './utils';

describe('encode utils', () => {
  it('encodes FileSources.text from persisted text without opening its filepath', async () => {
    const getStrategyFunctions = jest.fn();

    const result = await getFileStream(
      {} as never,
      {
        file_id: 'file-1',
        temp_file_id: 'temp-1',
        filename: 'notes.txt',
        filepath: 'text://file-1',
        source: FileSources.text,
        type: 'text/plain',
        text: 'hello text',
      } as never,
      {},
      getStrategyFunctions,
    );

    expect(result?.content).toBe(Buffer.from('hello text', 'utf8').toString('base64'));
    expect(result?.metadata).toMatchObject({
      file_id: 'file-1',
      temp_file_id: 'temp-1',
      filepath: 'text://file-1',
      source: FileSources.text,
      filename: 'notes.txt',
      type: 'text/plain',
    });
    expect(getStrategyFunctions).not.toHaveBeenCalled();
  });
});
