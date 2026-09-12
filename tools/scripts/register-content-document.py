#!/usr/bin/env python3
"""Program helper: register a new pack + content document across every registry.

usage: register-content-document.py <docName> <schemaName> <packKey> <packId> <capabilityKey> <capabilityId> <packVar> <packDir> <serviceType> <contractFile>
e.g.   register-content-document.py runs runs-catalog runs sw2d.runs runs progression.runs runsPack runs RunsService runs
"""
import json, sys
doc, schemaName, packKey, packId, capKey, capId, packVar, packDir, serviceType, contractFile = sys.argv[1:11]
def edit(p, old, new):
    s=open(p).read(); assert old in s, (p, old[:60]); open(p,'w').write(s.replace(old,new,1))
# contracts index
s=open('packages/contracts/src/index.ts').read()
if f"./{contractFile}.ts" not in s:
    edit('packages/contracts/src/index.ts', "export * from './pursuit.ts';", f"export * from './pursuit.ts';\nexport * from './{contractFile}.ts';")
# ids
s=open('packages/packs/src/ids.ts').read()
if f"{packKey}: '{packId}'" not in s:
    edit('packages/packs/src/ids.ts', "  pursuit: 'sw2d.pursuit',\n} as const;", f"  pursuit: 'sw2d.pursuit',\n  {packKey}: '{packId}',\n}} as const;")
    edit('packages/packs/src/ids.ts', "  pursuit: 'movement.pursuit',\n} as const;", f"  pursuit: 'movement.pursuit',\n  {capKey}: '{capId}',\n}} as const;")
# packs index
s=open('packages/packs/src/index.ts').read()
if packVar not in s:
    edit('packages/packs/src/index.ts', "export { pursuitPack, type PursuitService } from './pursuit/pursuitPack.ts';", f"export {{ pursuitPack, type PursuitService }} from './pursuit/pursuitPack.ts';\nexport {{ {packVar}, type {serviceType} }} from './{packDir}/{packVar}.ts';")
# validator
v='packages/schemas/src/validator.ts'
s=open(v).read()
if f"'{schemaName}'" not in s:
    camel=''.join(w.capitalize() for w in schemaName.split('-')); camel=camel[0].lower()+camel[1:]+'Schema'
    edit(v, "import pursuitCatalogSchema from '../schemas/pursuit-catalog.schema.json' with { type: 'json' };", f"import pursuitCatalogSchema from '../schemas/pursuit-catalog.schema.json' with {{ type: 'json' }};\nimport {camel} from '../schemas/{schemaName}.schema.json' with {{ type: 'json' }};")
    edit(v, "  | 'pursuit-catalog';", f"  | 'pursuit-catalog'\n  | '{schemaName}';")
    s=open(v).read()
    s=s.replace("  'pursuit-catalog',\n];", f"  'pursuit-catalog',\n  '{schemaName}',\n];")
    s=s.replace("  'pursuit-catalog': pursuitCatalogSchema,\n};", f"  'pursuit-catalog': pursuitCatalogSchema,\n  '{schemaName}': {camel},\n}};")
    s=s.replace("  'pursuit-catalog',\n] as const) {", f"  'pursuit-catalog',\n  '{schemaName}',\n] as const) {{")
    open(v,'w').write(s)
# content registry + test
s=open('packages/schemas/src/contentDocuments.ts').read()
if f"  {doc}:" not in s and f"  '{doc}':" not in s:
    key = doc if doc.replace('-','').isalnum() and '-' not in doc else f"'{doc}'"
    edit('packages/schemas/src/contentDocuments.ts', "  pursuit: { schemaName: 'pursuit-catalog' },\n};", f"  pursuit: {{ schemaName: 'pursuit-catalog' }},\n  {key}: {{ schemaName: '{schemaName}' }},\n}};")
    edit('packages/schemas/test/contentDocuments.test.ts', "'pursuit']", f"'pursuit', '{doc}']")
# content.ts template
camelDoc=''.join(w.capitalize() for w in doc.split('-')); camelDoc=camelDoc[0].lower()+camelDoc[1:]+'Data'
t='packages/cli/src/templates/src/content.ts.template'
s=open(t).read()
if camelDoc not in s:
    edit(t, "import pursuitData from '../content/pursuit.json' with { type: 'json' };", f"import pursuitData from '../content/pursuit.json' with {{ type: 'json' }};\nimport {camelDoc} from '../content/{doc}.json' with {{ type: 'json' }};")
    key = doc if '-' not in doc else f"'{doc}'"
    edit(t, "pursuit: pursuitData });", f"pursuit: pursuitData, {key}: {camelDoc} }});")
# main.ts template + generate.test packs string + test registries
m='packages/cli/src/templates/src/main.ts.template'
s=open(m).read()
if packVar not in s:
    edit(m, "  pursuitPack,\n} from '@sw2d/packs';", f"  pursuitPack,\n  {packVar},\n}} from '@sw2d/packs';")
    edit(m, "targetingPack, pursuitPack, GAME_SPECIFIC_PACK]", f"targetingPack, pursuitPack, {packVar}, GAME_SPECIFIC_PACK]")
    g='packages/cli/test/generate.test.ts'
    s=open(g).read().replace("targetingPack, pursuitPack, GAME_SPECIFIC_PACK'", f"targetingPack, pursuitPack, {packVar}, GAME_SPECIFIC_PACK'")
    open(g,'w').write(s)
    for p in ['packages/presets/test/catalogPackIntegrity.test.ts','packages/packs/test/capabilityIds.test.ts']:
        s=open(p).read()
        s=s.replace("  pursuitPack,\n} from", f"  pursuitPack,\n  {packVar},\n}} from").replace("  pursuitPack,\n];", f"  pursuitPack,\n  {packVar},\n];")
        open(p,'w').write(s)
print('registered', doc, packId)
