import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { pointerActionController } from '../../src/controllers/pointerActionController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('pointerActionController', () => {
  it('is neutral with no input', () => {
    const host = hostWithDefaults();
    host.update();

    expect(pointerActionController.read(host)).toEqual({
      primaryPressed: false,
      secondaryPressed: false,
      interactPressed: false,
      confirmPressed: false,
      cancelPressed: false,
    });
  });

  it('maps every supported semantic action correctly', () => {
    const host = hostWithDefaults();
    host.setActionValue('PRIMARY_ACTION', 1, 'pointer');
    host.setActionValue('SECONDARY_ACTION', 1, 'pointer');
    host.setActionValue('INTERACT', 1, 'pointer');
    host.setActionValue('CONFIRM', 1, 'pointer');
    host.setActionValue('CANCEL', 1, 'pointer');
    host.update();

    expect(pointerActionController.read(host)).toEqual({
      primaryPressed: true,
      secondaryPressed: true,
      interactPressed: true,
      confirmPressed: true,
      cancelPressed: true,
    });
  });

  it('exposes only the fields the semantic layer honestly supports - no spatial pointer data', () => {
    const intent = pointerActionController.read(hostWithDefaults());
    const keys = Object.keys(intent).sort();
    expect(keys).toEqual(
      ['cancelPressed', 'confirmPressed', 'interactPressed', 'primaryPressed', 'secondaryPressed'].sort(),
    );
    expect(keys).not.toContain('x');
    expect(keys).not.toContain('y');
    expect(keys).not.toContain('hover');
    expect(keys).not.toContain('drag');
  });
});
