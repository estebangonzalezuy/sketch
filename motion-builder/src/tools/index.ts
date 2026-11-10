import type { ToolDefinition } from '../core/tool';
import ascii from './ascii';
import chart from './chart';
import counter from './counter';
import pixelate from './pixelate';
import table from './table';
import tagShader from './tag-shader';
import text from './text';
import textExtruder from './text-extruder';
import spray from './spray';
import { MODE_TOOLS } from './spray/modes';

export const tools: readonly ToolDefinition[] = [text, tagShader, textExtruder, ascii, chart, table, counter, pixelate, spray, ...MODE_TOOLS];
