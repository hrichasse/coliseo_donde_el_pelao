export type Rooster = {
  id: number;
  created_at?: string;
  nombre_gallo: string;
  galpon: string;
  propietario: string;
  color_gallo: string;
  color_pata: string;
  peso_libras: number;
};

export type Galpon = {
  id: number;
  nombre: string;
  propietario: string;
  created_at?: string;
};

export type MatchPair = {
  id: number;
  gallo_a_id: number;
  gallo_b_id: number;
  gallo_a_nombre: string;
  gallo_b_nombre: string;
  galpon_a: string;
  galpon_b: string;
  propietario_a: string;
  propietario_b: string;
  peso_a_libras: number;
  peso_b_libras: number;
  diferencia_gramos: number;
  created_at?: string;
};
