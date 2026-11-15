/** Printed signature of one module export, as observed by module-export tests. */
export interface ExportSignature {
  readonly params: string;
  readonly returnType: string;
  readonly kind: string;
}
