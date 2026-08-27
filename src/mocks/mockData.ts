import { User } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'usr-bobinagem', name: 'Bobinagem', perfil: 'APONTADOR', setor: 'BOBINA AT/BT', linhas: ['MON', 'TRI'] },
  { id: 'usr-corte-laser', name: 'Corte Laser', perfil: 'APONTADOR', setor: 'CORTE LASER', linhas: ['MON', 'TRI'] },
  { id: 'usr-isolante', name: 'Isolante', perfil: 'APONTADOR', setor: 'ISOLANTE', linhas: ['MON', 'TRI'] },
  { id: 'usr-montagem-nucleo', name: 'Montagem do Núcleo/Corte do Núcleo', perfil: 'APONTADOR', setor: 'MONTAGEM NUCLEO', linhas: ['MON', 'TRI'] },
  { id: 'usr-montagem-final-mon', name: 'Montagem Final MON', perfil: 'APONTADOR', setor: 'MONTAGEM FINAL', linhas: ['MON'] },
  { id: 'usr-montagem-final-tri', name: 'Montagem Final TRI', perfil: 'APONTADOR', setor: 'MONTAGEM FINAL', linhas: ['TRI'] },
  { id: 'usr-mpa-mon', name: 'MPA MON', perfil: 'APONTADOR', setor: 'MPA', linhas: ['MON'] },
  { id: 'usr-mpa-tri', name: 'MPA TRI', perfil: 'APONTADOR', setor: 'MPA', linhas: ['TRI'] },
  { id: 'usr-pintura', name: 'Pintura', perfil: 'APONTADOR', setor: 'PINTURA', linhas: ['MON', 'TRI'] },
  { id: 'usr-solda', name: 'Solda', perfil: 'APONTADOR', setor: 'SOLDA', linhas: ['MON', 'TRI'] },
  { id: 'usr-epoxi', name: 'Epoxi', perfil: 'APONTADOR', setor: 'EPOXI', linhas: ['EPO'] },
  { id: 'usr-coordenacao', name: 'COORDENAÇÃO', perfil: 'COORDENACAO', setor: null, linhas: [] },
];
