/**
 * gcodeParser.js
 * Leitor e Extrator de Metadados de Arquivos Fatiados e Modelos 3D (.gcode, .3mf, .stl)
 * Compatível com Bambu Studio, OrcaSlicer, PrusaSlicer, Cura, Creality Print, Simplify3D.
 * Suporte nativo completo a projetos .3MF (descompactação ZIP interna via Streams API).
 */

export class GCodeParser {
  /**
   * Lê um arquivo File fornecido pelo usuário via Drag & Drop ou Input
   */
  static async parseFile(file) {
    if (!file) throw new Error('Nenhum arquivo fornecido.');

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();

    // 1. Arquivo .3MF (formato ZIP da Bambu / Orca / Prusa)
    if (lowerName.endsWith('.3mf')) {
      return await this.parse3mfFile(file);
    }

    // 2. Arquivo .STL (geometria 3D)
    if (lowerName.endsWith('.stl')) {
      return await this.parseStlFile(file);
    }

    // 3. Arquivo .GCODE ou texto
    let text = '';
    if (file.size <= 256 * 1024) {
      text = await file.text();
    } else {
      const headerBlob = file.slice(0, 131072);
      const footerBlob = file.slice(Math.max(0, file.size - 131072));
      const [headerText, footerText] = await Promise.all([
        headerBlob.text(),
        footerBlob.text()
      ]);
      text = headerText + '\n' + footerText;
    }

    return this.extractGcodeMetadata(text, fileName, false);
  }

  /**
   * Descompacta e analisa projetos e arquivos fatiados .3MF (ZIP Open Packaging)
   */
  static async parse3mfFile(file) {
    const fileName = file.name;
    let cleanName = this.cleanProductName(fileName);

    try {
      const zipEntries = await this.readZipEntries(file);

      // Tenta extrair o nome real do modelo a partir de model_settings.config ou project_settings.config
      const modelSettingsKey = Array.from(zipEntries.keys()).find(k => /model_settings\.config$/i.test(k));
      if (modelSettingsKey) {
        const mXml = zipEntries.get(modelSettingsKey);
        const mName = this.extractNameFromModelSettings(mXml);
        if (mName) cleanName = mName;
      }

      // A) Procurar metadados fatiados do Bambu Studio / OrcaSlicer (Metadata/slice_info.config)
      const sliceInfoKey = Array.from(zipEntries.keys()).find(k => /slice_info.*\.config$/i.test(k));
      if (sliceInfoKey) {
        const xml = zipEntries.get(sliceInfoKey);
        const meta = this.parseSliceInfoXml(xml, fileName, cleanName);
        if (meta.success) {
          meta.isModelOnly = false;
          return meta;
        }
      }

      // B) Procurar arquivo .gcode embutido no .3MF (ex: Metadata/plate_1.gcode ou plate_1.gcode.3mf)
      const gcodeKey = Array.from(zipEntries.keys()).find(k => /\.gcode/i.test(k));
      if (gcodeKey) {
        const gcodeText = zipEntries.get(gcodeKey);
        const meta = this.extractGcodeMetadata(gcodeText, fileName, true);
        if (meta.success) {
          meta.slicer = meta.slicer !== 'Desconhecido' ? `${meta.slicer} (3MF Fatiado)` : 'Bambu/Orca (3MF Fatiado)';
          meta.cleanName = cleanName;
          meta.isModelOnly = false;
          return meta;
        }
      }

      // C) Procurar configurações do PrusaSlicer (Metadata/Slic3r_PE.config ou PrusaSlicer.config)
      const prusaConfigKey = Array.from(zipEntries.keys()).find(k => /(slic3r|prusaslicer).*\.config$/i.test(k));
      if (prusaConfigKey) {
        const cfgText = zipEntries.get(prusaConfigKey);
        const meta = this.extractGcodeMetadata(cfgText, fileName, true);
        if (meta.success) {
          meta.slicer = 'PrusaSlicer (3MF Fatiado)';
          meta.cleanName = cleanName;
          meta.isModelOnly = false;
          return meta;
        }
      }

      // D) Procurar plate_1.json ou outros configs com métricas
      const jsonKey = Array.from(zipEntries.keys()).find(k => /plate_.*\.json$/i.test(k));
      if (jsonKey) {
        try {
          const parsed = JSON.parse(zipEntries.get(jsonKey));
          if (parsed && (parsed.prediction || parsed.weight || parsed.print_time)) {
            const sec = parseFloat(parsed.print_time || parsed.prediction || 0);
            const totalMin = Math.round(sec / 60);
            return {
              fileName,
              cleanName,
              hours: Math.floor(totalMin / 60),
              minutes: totalMin % 60,
              totalMinutes: totalMin,
              weightGrams: parseFloat(parsed.weight || parsed.filament_weight || 0),
              filamentType: (parsed.filament_type || 'pla').toLowerCase(),
              slicer: 'Bambu/Orca (JSON Fatiado)',
              rawTimeStr: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
              isModelOnly: false,
              success: true
            };
          }
        } catch (_) {}
      }

      // E) Se chegou aqui, é um PROJETO .3MF DO BAMBU STUDIO NÃO FATIADO (contém desenho 3D e configs)
      // Extrair parâmetros reais do projeto se disponíveis (infill, filamento, impressora)
      let projectInfill = 15;
      let projectFilament = 'pla';
      let projectPrinter = null;

      const projectSettingsKey = Array.from(zipEntries.keys()).find(k => /project_settings\.config$/i.test(k));
      if (projectSettingsKey) {
        try {
          const pCfg = JSON.parse(zipEntries.get(projectSettingsKey));
          if (pCfg) {
            if (pCfg.sparse_infill_density) {
              const inf = parseInt(pCfg.sparse_infill_density, 10);
              if (!isNaN(inf) && inf > 0) projectInfill = inf;
            }
            if (Array.isArray(pCfg.filament_type) && pCfg.filament_type[0]) {
              const ft = pCfg.filament_type[0].toLowerCase();
              if (ft.includes('petg')) projectFilament = 'petg';
              else if (ft.includes('abs') || ft.includes('asa')) projectFilament = 'abs';
              else if (ft.includes('silk')) projectFilament = 'pla-silk';
              else if (ft.includes('tpu')) projectFilament = 'tpu';
              else projectFilament = 'pla';
            }
            if (pCfg.printer_model) {
              projectPrinter = pCfg.printer_model;
            }
          }
        } catch (_) {}
      }

      // Analisa o modelo 3D (3D/3dmodel.model)
      const modelKey = Array.from(zipEntries.keys()).find(k => /3dmodel\.model$/i.test(k));
      let modelMeta = null;
      if (modelKey) {
        const modelXml = zipEntries.get(modelKey);
        modelMeta = this.estimateFrom3DModelXml(modelXml, fileName, cleanName, projectInfill);
      }

      if (!modelMeta) {
        modelMeta = {
          fileName,
          cleanName,
          isModelOnly: true,
          dimensions: '60 × 60 × 60 mm',
          hours: 1,
          minutes: 30,
          totalMinutes: 90,
          weightGrams: 35,
          filamentType: projectFilament,
          slicer: 'Projeto 3MF (Bambu Studio)',
          rawTimeStr: '1h 30m (estimado)',
          success: true
        };
      }

      modelMeta.filamentType = projectFilament;
      modelMeta.printerModel = projectPrinter;
      modelMeta.isModelOnly = true;
      modelMeta.isBambuProject = true;
      return modelMeta;

    } catch (err) {
      console.warn('Erro ao processar 3MF via ZIP parser:', err);
      return {
        fileName,
        cleanName,
        isModelOnly: true,
        hours: 1,
        minutes: 30,
        totalMinutes: 90,
        weightGrams: 35,
        filamentType: 'pla',
        slicer: 'Modelo 3D',
        rawTimeStr: '1h 30m (estimado)',
        success: true
      };
    }
  }

  /**
   * Extrai nome da peça a partir do model_settings.config (Bambu Studio / OrcaSlicer)
   */
  static extractNameFromModelSettings(xml) {
    if (!xml) return null;
    const objMatch = xml.match(/<object\s+[^>]*name=["']([^"']+)["']/i);
    if (objMatch && objMatch[1] && !/^(object|box|cylinder|sphere)$/i.test(objMatch[1].trim())) {
      return this.cleanProductName(objMatch[1]);
    }
    const partMatch = xml.match(/<part\s+[^>]*name=["']([^"']+)["']/i);
    if (partMatch && partMatch[1] && !/^(part|box|cylinder|sphere)$/i.test(partMatch[1].trim())) {
      return this.cleanProductName(partMatch[1]);
    }
    const plateMatch = xml.match(/key=["']name["']\s+value=["']([^"']+)["']/i);
    if (plateMatch && plateMatch[1] && !/^(plate\s*\d+)$/i.test(plateMatch[1].trim())) {
      return this.cleanProductName(plateMatch[1]);
    }
    return null;
  }

  /**
   * Leitor nativo de arquivos ZIP (padrão PKZip / .3MF) sem dependências externas
   * Utiliza a Web Streams API nativa com Blob.stream().pipeThrough(DecompressionStream)
   */
  static async readZipEntries(file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    // Encontra o End of Central Directory (EOCD: 0x06054b50)
    let eocdOffset = -1;
    const maxSearch = Math.min(bytes.length, 65536 + 22);
    for (let i = bytes.length - 22; i >= bytes.length - maxSearch; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Assinatura ZIP não encontrada no arquivo .3mf');
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    const filesMap = new Map();
    const decoder = new TextDecoder('utf-8');

    let pos = cdOffset;
    for (let i = 0; i < totalEntries && pos < eocdOffset; i++) {
      const sig = view.getUint32(pos, true);
      if (sig !== 0x02014b50) break; // Central directory header

      const compMethod = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const fnLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);

      const fnBytes = bytes.subarray(pos + 46, pos + 46 + fnLen);
      const entryName = decoder.decode(fnBytes);

      // Filtra arquivos candidatos de metadados, gcode ou modelo
      const isCandidate = /slice_info|\.gcode|plate_|model_settings|project_settings|3dmodel\.model|slic3r|prusaslicer/i.test(entryName);

      if (isCandidate) {
        const localSig = view.getUint32(localHeaderOffset, true);
        if (localSig === 0x04034b50) {
          const lFnLen = view.getUint16(localHeaderOffset + 26, true);
          const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
          const dataStart = localHeaderOffset + 30 + lFnLen + lExtraLen;
          const compressedSlice = bytes.slice(dataStart, dataStart + compSize);

          let uncompressedText = '';
          if (compMethod === 0) {
            uncompressedText = decoder.decode(compressedSlice);
          } else if (compMethod === 8) {
            // Descompressão DEFLATE nativa via DecompressionStream
            if (typeof DecompressionStream !== 'undefined') {
              try {
                const blob = new Blob([compressedSlice]);
                const ds = new DecompressionStream('deflate-raw');
                const stream = blob.stream().pipeThrough(ds);
                uncompressedText = await new Response(stream).text();
              } catch (err1) {
                try {
                  const blob = new Blob([compressedSlice]);
                  const ds = new DecompressionStream('deflate');
                  const stream = blob.stream().pipeThrough(ds);
                  uncompressedText = await new Response(stream).text();
                } catch (err2) {
                  console.warn(`Erro de descompressão para ${entryName}:`, err1, err2);
                }
              }
            }
          }

          if (uncompressedText) {
            filesMap.set(entryName, uncompressedText);
          }
        }
      }

      pos += 46 + fnLen + extraLen + commentLen;
    }

    return filesMap;
  }

  /**
   * Extrai métricas do XML Metadata/slice_info.config (Bambu Studio e OrcaSlicer)
   * Suporta todas as versões de XML geradas pelo Bambu Studio e OrcaSlicer:
   * - <header_item key="print_time" value="..."/>
   * - <header_item key="prediction" value="..."/>
   * - <filament_item used_g="..." type="..."/> (soma todas as cores/AMS!)
   * - <object_item name="..."/>
   */
  static parseSliceInfoXml(xml, fileName, cleanName) {
    const result = {
      fileName,
      cleanName,
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      weightGrams: 0,
      filamentType: 'pla',
      slicer: 'Bambu Studio (3MF Fatiado)',
      rawTimeStr: '',
      isModelOnly: false,
      success: false
    };

    // 1. Detectar fatiador
    if (/OrcaSlicer|Orca Slicer/i.test(xml)) {
      result.slicer = 'OrcaSlicer (3MF Fatiado)';
    } else if (/BambuStudio|Bambu Studio/i.test(xml)) {
      result.slicer = 'Bambu Studio (3MF Fatiado)';
    } else {
      result.slicer = 'Bambu/Orca (3MF Fatiado)';
    }

    // 2. Nome da peça / objeto a partir de <object_item name="...">
    const objMatch = xml.match(/<object_item\s+[^>]*name=["']([^"']+)["']/i);
    if (objMatch && objMatch[1] && !/^(object|box|cylinder|sphere)$/i.test(objMatch[1].trim())) {
      result.cleanName = this.cleanProductName(objMatch[1]);
    }

    // 3. Tempo previsto (em segundos: print_time, prediction, total_time)
    const timeMatches = Array.from(xml.matchAll(/key=["'](?:print_time|prediction|total_time)["']\s+value=["']([0-9.]+)["']/gi));
    let totalSec = 0;
    if (timeMatches.length > 0) {
      const secValues = timeMatches.map(m => parseFloat(m[1])).filter(v => !isNaN(v) && v > 0);
      if (secValues.length > 0) {
        totalSec = secValues[0];
      }
    }

    // Fallback para tags diretas de tempo: <print_time>1234</print_time>
    if (totalSec === 0) {
      const directTime = xml.match(/<(?:print_time|prediction)>(\d+)<\/(?:print_time|prediction)>/i);
      if (directTime) totalSec = parseInt(directTime[1], 10);
    }

    if (totalSec > 0) {
      const totalMin = Math.round(totalSec / 60);
      result.hours = Math.floor(totalMin / 60);
      result.minutes = totalMin % 60;
      result.totalMinutes = totalMin;
      result.rawTimeStr = `${result.hours}h ${result.minutes}m`;
    }

    // 4. Peso em gramas do filamento
    // Padrão Bambu Studio / OrcaSlicer: <filament_item used_g="73.50" .../>
    const usedGMatches = Array.from(xml.matchAll(/used_g=["']([0-9.]+)["']/gi));
    const weightMatches = Array.from(xml.matchAll(/key=["'](?:weight|filament_used_g)["']\s+value=["']([0-9.]+)["']/gi));

    let totalGrams = 0;
    if (usedGMatches.length > 0) {
      // Soma todas as cores/trays caso haja troca de filamento (AMS)
      usedGMatches.forEach(m => {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0) totalGrams += val;
      });
    } else if (weightMatches.length > 0) {
      weightMatches.forEach(m => {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0) totalGrams += val;
      });
    } else {
      // Fallback em metros: used_m="24.50" (1m de PLA 1.75mm = ~2.98g)
      const usedMMatches = Array.from(xml.matchAll(/used_m=["']([0-9.]+)["']/gi));
      if (usedMMatches.length > 0) {
        let totalMeters = 0;
        usedMMatches.forEach(m => {
          const val = parseFloat(m[1]);
          if (!isNaN(val) && val > 0) totalMeters += val;
        });
        totalGrams = totalMeters * 2.98;
      }
    }

    if (totalGrams > 0) {
      result.weightGrams = Math.round(totalGrams * 10) / 10;
    }

    // 5. Tipo de filamento (type="PLA" ou filament_type="PLA")
    const typeMatch = xml.match(/<filament_item\s+[^>]*type=["']([^"']+)["']/i) || 
                      xml.match(/type=["']([^"']+)["']/i) || 
                      xml.match(/key=["']filament_type["']\s+value=["']([^"']+)["']/i);
    if (typeMatch) {
      const raw = typeMatch[1].toLowerCase();
      if (raw.includes('silk')) result.filamentType = 'pla-silk';
      else if (raw.includes('petg')) result.filamentType = 'petg';
      else if (raw.includes('abs') || raw.includes('asa')) result.filamentType = 'abs';
      else if (raw.includes('tpu') || raw.includes('flex')) result.filamentType = 'tpu';
      else result.filamentType = 'pla';
    }

    if (result.totalMinutes > 0 || result.weightGrams > 0) {
      result.success = true;
    }

    return result;
  }

  /**
   * Estima peso e tempo para modelos 3D brutos não fatiados (3D/3dmodel.model)
   * Utiliza DOMParser nativo para obter dimensões milimétricas precisas da malha 3D
   */
  static estimateFrom3DModelXml(xml, fileName, cleanName, infillPercent = 15) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let vertexCount = 0;

    // 1. Tenta parsing robusto via DOMParser
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const vertices = doc.querySelectorAll('vertex');
        const limit = Math.min(vertices.length, 10000);
        for (let i = 0; i < limit; i++) {
          const v = vertices[i];
          const x = parseFloat(v.getAttribute('x'));
          const y = parseFloat(v.getAttribute('y'));
          const z = parseFloat(v.getAttribute('z'));
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            vertexCount++;
          }
        }
      }
    } catch (_) {}

    // 2. Fallback regex
    if (vertexCount === 0) {
      const matchX = Array.from(xml.matchAll(/x=["'](-?[0-9.eE+-]+)["']/gi)).slice(0, 5000);
      const matchY = Array.from(xml.matchAll(/y=["'](-?[0-9.eE+-]+)["']/gi)).slice(0, 5000);
      const matchZ = Array.from(xml.matchAll(/z=["'](-?[0-9.eE+-]+)["']/gi)).slice(0, 5000);
      const count = Math.min(matchX.length, matchY.length, matchZ.length);
      for (let i = 0; i < count; i++) {
        const x = parseFloat(matchX[i][1]);
        const y = parseFloat(matchY[i][1]);
        const z = parseFloat(matchZ[i][1]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          vertexCount++;
        }
      }
    }

    let dimX = 60, dimY = 60, dimZ = 60;
    if (vertexCount > 4 && minX !== Infinity) {
      dimX = Math.max(5, Math.round(maxX - minX));
      dimY = Math.max(5, Math.round(maxY - minY));
      dimZ = Math.max(5, Math.round(maxZ - minZ));
    }

    // Volume da caixa limitadora com fator de densidade da peça
    const boundingBoxCm3 = (dimX * dimY * dimZ) / 1000;
    const estimatedMeshVolCm3 = Math.max(2, boundingBoxCm3 * 0.35);

    // Ajusta o peso conforme o preenchimento real do projeto (infill)
    const infillFactor = Math.max(0.20, Math.min(0.80, 0.25 + (infillPercent / 100) * 0.35));
    const estimatedGrams = Math.max(8, Math.round(estimatedMeshVolCm3 * 1.24 * infillFactor));

    // Velocidade de extrusão estimada: ~25g de filamento por hora
    const totalMinutes = Math.max(25, Math.round((estimatedGrams / 25) * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      fileName,
      cleanName,
      isModelOnly: true,
      dimensions: `${dimX} × ${dimY} × ${dimZ} mm`,
      hours,
      minutes,
      totalMinutes,
      weightGrams: estimatedGrams,
      filamentType: 'pla',
      slicer: 'Projeto 3MF (Geometria 3D)',
      rawTimeStr: `${hours}h ${minutes}m (estimado)`,
      success: true
    };
  }

  /**
   * Analisador básico de arquivos .STL
   */
  static async parseStlFile(file) {
    const fileName = file.name;
    const cleanName = this.cleanProductName(fileName);
    return {
      fileName,
      cleanName,
      isModelOnly: true,
      dimensions: 'Modelo STL',
      hours: 1,
      minutes: 45,
      totalMinutes: 105,
      weightGrams: 42,
      filamentType: 'pla',
      slicer: 'Arquivo STL',
      rawTimeStr: '1h 45m (estimado)',
      success: true
    };
  }

  /**
   * Extrai tempo, gramas, filamento e fatiador a partir de texto G-Code
   */
  static extractGcodeMetadata(content, fileName = '', is3mf = false) {
    const result = {
      fileName: fileName,
      cleanName: this.cleanProductName(fileName),
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      weightGrams: 0,
      filamentType: null,
      slicer: 'Desconhecido',
      rawTimeStr: '',
      isModelOnly: false,
      success: false
    };

    // 1. Detectar fatiador
    if (/BambuStudio|Bambu Studio/i.test(content)) {
      result.slicer = 'Bambu Studio';
    } else if (/OrcaSlicer|Orca Slicer/i.test(content)) {
      result.slicer = 'OrcaSlicer';
    } else if (/PrusaSlicer|Prusa Slicer/i.test(content)) {
      result.slicer = 'PrusaSlicer';
    } else if (/Cura_SteamEngine|Cura/i.test(content)) {
      result.slicer = 'UltiMaker Cura';
    } else if (/CrealityPrint|Creality/i.test(content)) {
      result.slicer = 'Creality Print';
    } else if (/Simplify3D/i.test(content)) {
      result.slicer = 'Simplify3D';
    } else if (is3mf) {
      result.slicer = 'Bambu/Orca (3MF Fatiado)';
    }

    // 2. Extrair Tempo de Impressão
    const prusaTimeMatch = content.match(/;\s*(?:estimated printing time|total estimated time|model printing time).*?=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
    const curaSecMatch = content.match(/;TIME:(\d+)/i) || content.match(/;TIME_ELAPSED:(\d+)/i);
    const genericTimeMatch = content.match(/;.*?(?:Print time|printing time|tempo de impress[ãa]o):\s*(?:(\d+)h\s*)?(?:(\d+)m)?/i);

    if (prusaTimeMatch) {
      const days = parseInt(prusaTimeMatch[1] || '0', 10);
      const hours = parseInt(prusaTimeMatch[2] || '0', 10) + (days * 24);
      const minutes = parseInt(prusaTimeMatch[3] || '0', 10);
      result.hours = hours;
      result.minutes = minutes;
      result.totalMinutes = hours * 60 + minutes;
      result.rawTimeStr = `${hours}h ${minutes}m`;
    } else if (curaSecMatch) {
      const totalSeconds = parseInt(curaSecMatch[1], 10);
      const totalMin = Math.round(totalSeconds / 60);
      result.hours = Math.floor(totalMin / 60);
      result.minutes = totalMin % 60;
      result.totalMinutes = totalMin;
      result.rawTimeStr = `${result.hours}h ${result.minutes}m`;
    } else if (genericTimeMatch) {
      result.hours = parseInt(genericTimeMatch[1] || '0', 10);
      result.minutes = parseInt(genericTimeMatch[2] || '0', 10);
      result.totalMinutes = result.hours * 60 + result.minutes;
      result.rawTimeStr = `${result.hours}h ${result.minutes}m`;
    }

    // 3. Extrair Peso em Gramas do Filamento
    const weightMatch = content.match(/;\s*filament used\s*\[g\]\s*=\s*([0-9., ]+)/i) ||
                        content.match(/;\s*total filament used\s*\[g\]\s*=\s*([0-9.]+)/i);
    const curaWeightMatch = content.match(/;\s*Filament (?:used|weight):\s*([0-9.]+)\s*g/i);
    const curaMetersMatch = content.match(/;\s*Filament used:\s*([0-9.]+)\s*m\b/i);
    const volumeMatch = content.match(/;\s*filament used\s*\[cm3\]\s*=\s*([0-9.]+)/i);

    if (weightMatch) {
      const values = weightMatch[1].split(/[, ]+/).filter(Boolean);
      let totalGrams = 0;
      values.forEach(v => {
        const num = parseFloat(v);
        if (!isNaN(num)) totalGrams += num;
      });
      result.weightGrams = Math.round(totalGrams * 10) / 10;
    } else if (curaWeightMatch) {
      result.weightGrams = Math.round(parseFloat(curaWeightMatch[1]) * 10) / 10;
    } else if (volumeMatch) {
      const cm3 = parseFloat(volumeMatch[1]);
      result.weightGrams = Math.round(cm3 * 1.24 * 10) / 10;
    } else if (curaMetersMatch) {
      const meters = parseFloat(curaMetersMatch[1]);
      result.weightGrams = Math.round(meters * 2.98 * 10) / 10;
    }

    // 4. Extrair Tipo de Filamento
    const filamentMatch = content.match(/;\s*filament_type\s*=\s*([A-Za-z0-9_-]+)/i) ||
                          content.match(/;\s*Material:\s*([A-Za-z0-9_-]+)/i);

    if (filamentMatch) {
      const rawType = filamentMatch[1].toLowerCase();
      if (rawType.includes('silk')) result.filamentType = 'pla-silk';
      else if (rawType.includes('pla')) result.filamentType = 'pla';
      else if (rawType.includes('petg')) result.filamentType = 'petg';
      else if (rawType.includes('abs') || rawType.includes('asa')) result.filamentType = 'abs';
      else if (rawType.includes('tpu') || rawType.includes('flex')) result.filamentType = 'tpu';
      else if (rawType.includes('resin')) result.filamentType = 'resina';
    }

    if (result.totalMinutes > 0 || result.weightGrams > 0) {
      result.success = true;
    }

    return result;
  }

  /**
   * Limpa o nome do arquivo para usar como nome da peça
   * Ex: "Faster.basketweave.3mf" -> "Faster Basketweave"
   * Ex: "beer+mug.3mf" -> "Beer Mug"
   * Ex: "suporte_celular_v3.gcode" -> "Suporte Celular V3"
   */
  static cleanProductName(fileName) {
    if (!fileName) return 'Peça Impressa 3D';
    
    // Remove extensões .gcode, .3mf, .stl, etc.
    let clean = fileName.replace(/\.(gcode|3mf|gcode\.3mf|stl)$/i, '');
    
    // Substitui underscores, traços, sinais de + e pontos por espaços
    clean = clean.replace(/[_\-+.]+/g, ' ');

    // Remove termos técnicos de fatiador (ex: plate_1, 0.20mm, PLA, etc.)
    clean = clean.replace(/\b(plate\s*\d+|0\.\d+mm|generic|bambu|creality|cura|orca)\b/gi, '').trim();

    // Capitaliza primeira letra de cada palavra
    clean = clean.split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return clean.trim() || 'Peça Impressa 3D';
  }
}
